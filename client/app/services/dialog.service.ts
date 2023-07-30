import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { NgxLazyLoaderService, NgxLazyLoaderComponent } from '@dotglitch/ngx-lazy-loader';

const { log, warn } = console;

export type DialogOptions = Partial<Omit<MatDialogConfig<any>, 'data'> & {
    group: string,
    inputs: { [key: string]: any; },
    outputs: { [key: string]: Function; };
}>;

@Injectable({
    providedIn: 'root'
})
export class DialogService {

    constructor(
        private dialog: MatDialog,
        private lazyLoader: NgxLazyLoaderService
    ) { }

    /**
     * Open a dialog item.
     *
     * Returns a promise that resolves when the dialog is closed.
     * If the dialog is closed with MatDialog.close(result),
     * the result passed to .close() will be returned from the promise.
     *
     * @param name Which dialog to open
     * @returns promise<result>
     */
    open(name: string, data: DialogOptions = {}): Promise<any> {
        log("Open dialog " + name, data);

        return new Promise((resolve, reject) => {

            if (!this.lazyLoader.isComponentRegistered(name, data.group)) {
                console.warn(name, "does not exist in", data.group)
                return;
            }
            // default options. can be overridden.
            const defaults: any = {
                maxHeight: "90vh",
                maxWidth: "90vw",
                closeOnNavigation: true,
                restoreFocus: true,
            };

            // Apply defaults
            const opts = {
                ...defaults,
                ...data,
                data: {
                    id: name,
                    group: data.group,
                    inputs: data.inputs || {},
                    outputs: data.outputs || {}
                }
            };

            const dialogRef = this.dialog.open(NgxLazyLoaderComponent, opts);

            const s = dialogRef.afterClosed().subscribe(result => {
                log("Dialog closed " + name, result);
                resolve(result);
                s.unsubscribe();
            });
        });
    }

    confirmAction(title: string) {
        return true;
    }
}
