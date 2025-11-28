import type { UserMenuItem } from './types';

export interface ObjectStorageConfig {
    enabled: boolean;
    publicBaseUrl?: string;
    uploadPresignUrl?: string;
    finalizeUploadUrl?: string;
}

export interface ClientConfig {
    ws_url: string;
    upload_url: string;
    user_menu_extra_items: UserMenuItem[];
    user_menu_show_basic_auth_logout: boolean;
    logo_url?: string;
    app_title?: string;
    logout_url?: string;
    object_storage?: ObjectStorageConfig;
    default_locale?: string;
    supported_locales?: string[];
}

export function parseClientConfig(json: any): ClientConfig {
    const required = ["ws_url", "upload_url", "user_menu_extra_items", "user_menu_show_basic_auth_logout"];
    for (let key of required) {
        if (!(key in json)) throw Error("Missing key '" + key + "' in client config file");
    }

    const objectStorage: ObjectStorageConfig | undefined = json.object_storage
        ? {
              enabled: Boolean(json.object_storage.enabled),
              publicBaseUrl: json.object_storage.public_base_url ?? json.object_storage.publicBaseUrl,
              uploadPresignUrl: json.object_storage.upload_presign_url ?? json.object_storage.presign_upload_url,
              finalizeUploadUrl: json.object_storage.finalize_upload_url ?? json.object_storage.upload_finalize_url,
          }
        : undefined;

    return {
        ws_url: json.ws_url,
        upload_url: json.upload_url,
        user_menu_extra_items: json.user_menu_extra_items ?? [],
        user_menu_show_basic_auth_logout: Boolean(json.user_menu_show_basic_auth_logout),
        logo_url: json.logo_url,
        app_title: json.app_title,
        logout_url: json.logout_url,
        object_storage: objectStorage,
        default_locale: json.default_locale ?? json.locale,
        supported_locales: json.supported_locales,
    };
}
