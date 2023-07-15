import express, { Express } from 'express';
import helmet from 'helmet';
import http from 'http';

import { ErrorHandler } from './errors';
import { FilesystemApi } from "./api/files";
import { RestApi } from './api/rest';
import { logger } from './util';
import { DatabaseTableApi } from './api/database-controller';
import { PipelineApi } from './api/pipeline';

const onFinished = require('on-finished');

process.on("uncaughtException", err => {
    logger.error("uncaught:", err);
});

const getDuration = (req, res) => {
    if (!req._startAt || !res._startAt) {
        // missing request and/or response start time
        return '0';
    }

    // calculate diff
    var ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
        (res._startAt[1] - req._startAt[1]) * 1e-6;

    // return truncated value
    return ms.toFixed(2);
}

(async () => {
    const app: Express = express();

    app.use(express.json())
    app.use((req, res, next) => {
        onFinished(req, () => {
            logger.info({
                kind: "http",
                // tenant: req.tenant,
                // user: req.session?.profile?.email || req.session?.userinfo?.mail || "anonymous",
                // sid: req.sessionID,
                // uid: req.session?.userinfo?.uid,
                // uid2: req.session?.userinfo?.uid2,
                // Ips prefixed with x- are not reliable sources of information
                ip: req.get("x-envoy-external-address") || ("x-" + req.ip),
                method: req.method,
                status: res.status,
                url: req.url,
                size: (parseInt(res.get("content-length")) || 0),
                duration: getDuration(req, res)
            });
        })
        next();
    })

    app.use("/api/filesystem", FilesystemApi);
    app.use("/api/rest", RestApi);

    // app.use("/api/agent", DatabaseTableApi("agent"));
    // app.use("/api/artifacts", DatabaseTableApi("pipelineArtifact"));
    // app.use("/api/pipeline/task", DatabaseTableApi("pipelineTask"));
    // app.use("/api/pipeline/job", DatabaseTableApi("pipelineJob"));
    // app.use("/api/pipeline/stage", DatabaseTableApi("pipelineStage"));

    // app.use("/api/jobs", DatabaseTableApi("jobInstance"));

    app.use("/api/pipeline", PipelineApi);
    app.use("/api/db", DatabaseTableApi());



    // app.use("/api/secrets", DatabaseTableApi("secret"));
    // app.use("/api/environment-variables", DatabaseTableApi("environmentVariable"));


    // Listen on the specified port.
    // await server.start();
    // const httpserver = server.getServer();
    // new TerminalSocketService(httpserver);
    // new MetricSocketService(httpserver);

    app.use((req, res, next) => next(404));
    app.use(ErrorHandler);

    const server = http.createServer(app);
    const port = 3000;
    server.listen(port);
    server.on("error", (e: any) => console.error(e.code == "EACCES"
            ? `Port ${port} requires elevated permissions`
            : e.code == "EADDRINUSE"
            ? `Port ${port} is already in use`
            : e
        )
    );
    server.on("listening", () => console.log(`Server listening on port ${port}`))
})();
