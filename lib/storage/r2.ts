export type ObjectStoragePutInput = {
  key: string;
  contentType: string;
  body: ArrayBuffer | Uint8Array | string;
};

export type ObjectStorage = {
  put(input: ObjectStoragePutInput): Promise<{ key: string; url?: string }>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
};

export class R2CompatibleStorage implements ObjectStorage {
  constructor(
    private readonly config: {
      bucket: string;
      publicBaseUrl?: string;
    }
  ) {}

  async put(input: ObjectStoragePutInput) {
    return {
      key: input.key,
      url: this.config.publicBaseUrl ? `${this.config.publicBaseUrl.replace(/\/$/, "")}/${input.key}` : undefined
    };
  }

  async getSignedUrl(key: string) {
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    }

    throw new Error("R2 signed URL generation requires an S3-compatible client implementation.");
  }

  async delete() {
    return undefined;
  }
}

