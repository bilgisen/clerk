import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
// Initialize the S3 client for R2
const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY,
    },
});
async function setupCors() {
    try {
        const command = new PutBucketCorsCommand({
            Bucket: process.env.R2_UPLOAD_IMAGE_BUCKET_NAME,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                        AllowedOrigins: ["*"],
                        ExposeHeaders: ["ETag"],
                        MaxAgeSeconds: 3000,
                    },
                ],
            },
        });
        const response = await r2.send(command);
        console.log("CORS configuration updated successfully:", response);
    }
    catch (error) {
        console.error("Error setting up CORS:", error);
        throw error;
    }
}
// Run the setup
setupCors().catch(console.error);
