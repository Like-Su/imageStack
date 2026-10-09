ALTER TYPE "StorageProviderType" ADD VALUE IF NOT EXISTS 'RUSTFS';

ALTER TABLE "UploadSession"
ADD COLUMN "storageProvider" "StorageProviderType" NOT NULL DEFAULT 'LOCAL_FS',
ADD COLUMN "storageBucket" TEXT;
