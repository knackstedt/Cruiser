import Surreal from 'surrealdb.js';
import execa from 'execa';
import { JobInstance } from '../types/agent-task';
import { Pipeline, PipelineJob, PipelineTaskGroup } from '../types/pipeline';
import { getLogger, orderSort, sleep } from './util/util';
import { ResolveSources } from './source-resolver';

const logger = getLogger("agent");


const freezePollInterval = 5000;

const validateJobCanRun = async (job: PipelineJob) => {
    const tasks = job.taskGroups?.map(t => t.tasks).flat();
    if (!tasks || tasks.length == 0)
        throw new Error("No work to do");

}

async function freezeTaskProcessing(db: Surreal, { taskGroup, agentTask }: { taskGroup: PipelineTaskGroup, agentTask: JobInstance; }) {

    let [freezePoint] = await db.create(`taskFreezePoints:ulid()`, {
        taskGroup: taskGroup.id,
        jobInstance: agentTask.id
    });

    while (true) {
        await sleep(freezePollInterval);

        [freezePoint] = await db.select(freezePoint.id) as any;

        // If the freeze point has been removed, resume the pipeline
        if (!freezePoint) break;
    }
}

const RunTaskGroupsInParallel = (db: Surreal, taskGroups: PipelineTaskGroup[], jobInstance) => {
    taskGroups?.sort(orderSort);

    return Promise.all(taskGroups.map(async taskGroup => {

        const tasks = taskGroup.tasks.sort(orderSort);

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];

            const env = {};
            const environment: { key: string, value: string; }[] =
                await db.query(`RETURN fn::task_get_environment(${task.id})`) as any;

            environment.forEach(({ key, value }) => env[key] = value);

            if (task.freezeBeforeRun) {
                logger.info(`Encountered freeze marker in task group ${taskGroup.label} before task ${task.label}`, taskGroup);
                await freezeTaskProcessing(db, { taskGroup, agentTask: jobInstance });
                logger.info(`Unfroze freeze marker in task group ${taskGroup.label} before task ${task.label}`, taskGroup);
            }

            logger.info(`Encountered freeze marker in task group ${taskGroup.label} after task ${task.label}`, taskGroup);

            await execa(task.command, task.arguments, {
                env: env,
                cwd: task.workingDirectory,
                timeout: task.commandTimeout || 0
            }).then(res => {
                logger.info(`Task ${task.label} in group ${taskGroup.label} successfully completed`, res);
            })
                .catch(err => {
                    logger.error(`Task ${task.label} in group ${taskGroup.label} failed`, err);
                });

            if (task.freezeAfterRun) {
                logger.info(`Encountered freeze marker in task group ${taskGroup.label} after task ${task.label}`, taskGroup);
                await freezeTaskProcessing(db, { taskGroup, agentTask: jobInstance });
                logger.info(`Unfroze freeze marker in task group ${taskGroup.label} after task ${task.label}`, taskGroup);
            }
        }

        return sleep(1);
    }));
}

export const Agent = async (taskId: string, db: Surreal) => {

    const jobInstance: JobInstance = await db.query(`SELECT ${taskId} FETCH pipeline, job`)[0] as any;
    const pipeline = jobInstance?.pipeline;
    const job = jobInstance?.job;

    if (!jobInstance) {
        logger.fatal({ msg: "Failed to resolve job instance" });
        // process.exit(1);
        return;
    }

    if (!pipeline || !job) {
        await db.merge(taskId, {
            state: "failed",
            failReason: `Failed to resolve [${!!pipeline ? 'pipeline' : ''}${!!job ? !!pipeline ? ', job' : 'job' : ''}]`
        });
        // process.exit(1)
        return;
    }

    logger.info({ msg: "Agent initialized." });

    // Perform preflight checks
    await db.merge(taskId, { state: "initializing" });
    await validateJobCanRun(job);

    // Download sources
    await db.merge(taskId, { state: "cloning" });
    await ResolveSources(pipeline, job);

    // Follow job steps to build code
    await db.merge(taskId, { state: "building" });
    await RunTaskGroupsInParallel(db, job.taskGroups, jobInstance);

    // Seal (compress) artifacts
    await db.merge(taskId, { state: "sealing" });

    // TODO: compress and upload artifacts
    // await Promise.all(job.artifacts.map(async a => {
    //     a.source;
    //     await execa('')
    // }));

    await db.merge(taskId, { state: "finished" });
}
