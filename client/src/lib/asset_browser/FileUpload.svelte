<script lang="ts">
import LocalStorageCookies from "@/cookies";
import Dropzone from "svelte-file-dropzone"
import type { ObjectStorageConfig } from "@/config";
import { t } from "@/i18n";

let dragActive: boolean = $state(false);
let files = {
    accepted: [] as File[],
    rejected: [] as File[]
};


    interface Props {
        postUrl: string;
        // Passed to HTTP POST request:
        listingData: Object;
        mediaFileAddedAction: string|undefined;
        objectStorage?: ObjectStorageConfig;
        children?: import('svelte').Snippet;
    }

    let {
        postUrl,
        listingData,
        mediaFileAddedAction,
        objectStorage,
        children
    }: Props = $props();


let progressBar: HTMLProgressElement | undefined = $state();
let statusTxt: string = $state("");
let uploadingNow: boolean = $state(false);
let form: HTMLFormElement | undefined;

type PresignUploadPlan = {
    uploadUrl: string;
    method?: string;
    headers?: Record<string, string>;
    fields?: Record<string, string>;
    fileUrl?: string;
    finalizeUrl?: string;
};

function afterUpload()
{
    // Delay for 3 secs to allow user to see the progress bar
    setTimeout(() => {
        statusTxt = "";
        uploadingNow = false;
        if (form) { form.reset(); }
        if (progressBar) progressBar.value = 0;
    }, 3000);
}

function progressHandler(event: ProgressEvent<XMLHttpRequestEventTarget>)
{
    uploadingNow = true;
    const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
    if (progressBar) progressBar.value = percent;
    statusTxt = $t('upload.progress', { percent });
}

function completeHandler(event: ProgressEvent<XMLHttpRequestEventTarget>) {
    const responseTxt = (event.target as any)?.responseText;
    statusTxt = responseTxt && responseTxt.length > 0 ? responseTxt : $t('upload.complete');
    if (progressBar) progressBar.value = 100;
    afterUpload();
}

function errorHandler(_event: ProgressEvent<XMLHttpRequestEventTarget>) {
    statusTxt = $t('upload.failed');
    afterUpload();
}

function abortHandler(_event: ProgressEvent<XMLHttpRequestEventTarget>) {
    statusTxt = $t('upload.aborted');
    afterUpload();
}

function buildUploadCookies() {
    let upload_cookies = { ...LocalStorageCookies.getAllNonExpired() };
    if (mediaFileAddedAction)
        upload_cookies["media_file_added_action"] = mediaFileAddedAction;
    upload_cookies["listing_data_json"] = JSON.stringify(listingData);
    return upload_cookies;
}

function configureXhr(method: string, url: string, headers: Record<string, string> = {}) {
    var ajax = new XMLHttpRequest();
    ajax.upload.addEventListener("progress", progressHandler, false);
    ajax.addEventListener("load", completeHandler, false);
    ajax.addEventListener("error", errorHandler, false) ;
    ajax.addEventListener("abort", abortHandler, false);
    ajax.open(method, url);
    Object.entries(headers).forEach(([k, v]) => ajax.setRequestHeader(k, v));
    return ajax;
}

function waitForXhr(ajax: XMLHttpRequest): Promise<void> {
    return new Promise((resolve, reject) => {
        ajax.addEventListener("load", () => resolve());
        ajax.addEventListener("error", () => reject(new Error("upload failed")));
        ajax.addEventListener("abort", () => reject(new Error("upload aborted")));
    });
}

async function requestObjectStoragePlan(file: File, upload_cookies: any): Promise<PresignUploadPlan> {
    if (!objectStorage?.enabled || !objectStorage.uploadPresignUrl) {
        throw new Error("Object storage upload is not configured");
    }
    const res = await fetch(objectStorage.uploadPresignUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CLAPSHOT-COOKIES": JSON.stringify(upload_cookies),
        },
        body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            listingData,
            mediaFileAddedAction,
        }),
    });
    if (!res.ok) throw new Error(`Presign failed: ${res.status}`);
    return await res.json();
}

async function finalizeObjectUpload(plan: PresignUploadPlan, file: File, upload_cookies: any) {
    const finalizeUrl = plan.finalizeUrl ?? objectStorage?.finalizeUploadUrl;
    if (!finalizeUrl) return;
    try {
        await fetch(finalizeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CLAPSHOT-COOKIES": JSON.stringify(upload_cookies),
            },
            body: JSON.stringify({
                fileUrl: plan.fileUrl ?? plan.uploadUrl,
                filename: file.name,
                size: file.size,
                contentType: file.type,
                listingData,
                mediaFileAddedAction,
            }),
        });
    } catch (err) {
        console.error("Finalize upload failed", err);
    }
}

async function uploadViaObjectStorage(file: File, upload_cookies: any) {
    const plan = await requestObjectStoragePlan(file, upload_cookies);
    const method = plan.method ?? (plan.fields ? "POST" : "PUT");
    const ajax = configureXhr(method, plan.uploadUrl, plan.headers ?? {});
    uploadingNow = true;
    statusTxt = $t('upload.uploading', { filename: file.name });
    if (plan.fields) {
        const formdata = new FormData();
        Object.entries(plan.fields).forEach(([k, v]) => formdata.append(k, v as any));
        formdata.append("file", file);
        ajax.send(formdata);
    } else {
        ajax.send(file);
    }
    await waitForXhr(ajax);
    await finalizeObjectUpload(plan, file, upload_cookies);
}

async function uploadViaHttp(file: File, upload_cookies: any) {
    var formdata = new FormData();
    formdata.append("fileupload", file);
    var ajax = configureXhr("POST", postUrl, {
        "X-FILE-NAME": encodeURIComponent(file.name),
        "X-CLAPSHOT-COOKIES": JSON.stringify(upload_cookies),
    });
    uploadingNow = true;
    statusTxt = $t('upload.uploading', { filename: file.name });
    ajax.send(formdata);
    await waitForXhr(ajax);
}

async function upload() {
    const upload_cookies = buildUploadCookies();
    for (let i=0; i<files.accepted.length; i++) {
        const file = files.accepted[i];
        try {
            if (objectStorage?.enabled && objectStorage.uploadPresignUrl) {
                await uploadViaObjectStorage(file, upload_cookies);
            } else {
                await uploadViaHttp(file, upload_cookies);
            }
        } catch (err) {
            console.error("Upload failed", err);
            const key = objectStorage?.enabled && objectStorage.uploadPresignUrl ? 'upload.presignError' : 'upload.failed';
            statusTxt = $t(key);
            afterUpload();
        }
    }
    files.accepted = [];
    files.rejected = [];
}

function onDropFiles(e: any) {
    dragActive = false;
    files.accepted = e.detail.acceptedFiles || [];
    files.rejected = e.detail.fileRejections || [];
    if (files.rejected.length > 0 && files.accepted.length == 0) {
        alert($t('upload.rejected'));
    }
    upload().catch((err) => {
        console.error("Upload error", err);
        statusTxt = $t('upload.failed');
    });
}
</script>


<div class="w-full h-full inline-block p-0 m-0">
    <div class="w-full h-full" class:display-none={uploadingNow} >
        <Dropzone
            accept={['video/*', 'image/*', 'audio/*']}
            disableDefaultStyles={true}
            containerClasses="custom-dropzone {dragActive ? 'drag-active' : ''}"
            containerStyles = "borderColor: '#fff', color: '#90cdf4'"
            on:drop={onDropFiles}
            on:dragenter={() => { dragActive = true; }}
            on:dragleave={() => { dragActive = false; }}
        >
          {#if uploadingNow}
            <div class="p-2">
                <progress bind:this={progressBar} value="0" max="100" class="w-[90%] m-2"></progress>
                <div class="text-xs overflow-ellipsis break-words">{statusTxt}</div>
            </div>
          {:else}
            {@render children?.()}
          {/if}
        </Dropzone>
    </div>
</div>


<style>
:global(.custom-dropzone) {
    text-align: center;
    background-color: rgb(15, 23, 42);
    color: #64748b;
    width: 100%;
    height: 100%;

}
:global(.custom-dropzone.drag-active) {
    border-color: #90cdf4;
    color: #9fd0ee;
    background-color: rgb(25, 33, 52);
    transition: background-color 0.1s ease-in-out
}
</style>
