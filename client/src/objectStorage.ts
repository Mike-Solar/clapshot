import type * as Proto3 from '@clapshot_protobuf/typescript';
import type { ObjectStorageConfig } from './config';

function trimTrailingSlash(url: string): string {
    return url.replace(/\/+$/, '');
}

function normalizeUrlPath(url: string): string | null {
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.pathname + parsed.search;
    } catch (err) {
        console.error('Failed to normalize URL', url, err);
        return null;
    }
}

function rewriteUrl(url: string | undefined, cfg?: ObjectStorageConfig): string | undefined {
    if (!url || !cfg?.enabled || !cfg.publicBaseUrl) return url;
    const path = normalizeUrlPath(url);
    if (!path) return url;
    return `${trimTrailingSlash(cfg.publicBaseUrl)}${path}`;
}

export function applyObjectStorageToMediaFile(media: Proto3.MediaFile, cfg?: ObjectStorageConfig): Proto3.MediaFile {
    if (!cfg?.publicBaseUrl) return media;

    const subtitles = media.subtitles?.map((sub) => ({
        ...sub,
        playbackUrl: rewriteUrl(sub.playbackUrl, cfg),
        origUrl: rewriteUrl((sub as any).origUrl, cfg),
    })) ?? [];

    const previewData = media.previewData
        ? {
              ...media.previewData,
              thumbUrl: rewriteUrl(media.previewData.thumbUrl, cfg),
              thumbSheet: media.previewData.thumbSheet
                  ? {
                        ...media.previewData.thumbSheet,
                        url: rewriteUrl(media.previewData.thumbSheet.url, cfg),
                    }
                  : undefined,
          }
        : undefined;

    return {
        ...media,
        playbackUrl: rewriteUrl(media.playbackUrl, cfg),
        origUrl: rewriteUrl((media as any).origUrl, cfg),
        subtitles,
        previewData,
    };
}

function applyToFolderListingItem(item: Proto3.PageItem_FolderListing_Item, cfg?: ObjectStorageConfig): Proto3.PageItem_FolderListing_Item {
    const updatedFolder = item.folder
        ? {
              ...item.folder,
              previewItems: item.folder.previewItems?.map((preview) => applyToFolderListingItem(preview, cfg)) ?? [],
          }
        : undefined;

    return {
        ...item,
        mediaFile: item.mediaFile ? applyObjectStorageToMediaFile(item.mediaFile, cfg) : undefined,
        folder: updatedFolder,
    };
}

export function applyObjectStorageToPageItems(items: Proto3.PageItem[], cfg?: ObjectStorageConfig): Proto3.PageItem[] {
    if (!cfg?.enabled || !cfg.publicBaseUrl) return items;
    return items.map((item) => {
        if (item.folderListing) {
            const folderListing = item.folderListing;
            return {
                ...item,
                folderListing: {
                    ...folderListing,
                    items: folderListing.items.map((fl) => applyToFolderListingItem(fl, cfg)),
                },
            };
        }
        return item;
    });
}
