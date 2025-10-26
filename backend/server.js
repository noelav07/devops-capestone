const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false
}));
app.use(express.json());
app.use(express.static('.'));

// Configure AWS S3
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        files: 10 // Maximum 10 files
    },
    fileFilter: (req, file, cb) => {
        cb(null, true); // allow all file types
    }
});

// Generate pre-signed URL for direct S3 upload
const generatePresignedUrl = async (bucketName, key, contentType) => {
    const params = {
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
        Expires: 60 * 5 // 5 minutes
    };
    try {
        const presignedUrl = await s3.getSignedUrlPromise('putObject', params);
        return presignedUrl;
    } catch (error) {
        throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
};

// Generate unique filename
const generateUniqueFileName = (originalName) => {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const uniqueId = uuidv4();
    return `${name}-${uniqueId}${ext}`;
};

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'CloudDrive Backend API', status: 'running' });
});

// Generate presigned URLs for direct S3 upload
app.post('/generate-presigned-urls', async (req, res) => {
    try {
        const { files } = req.body;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files provided' });
        }

        const bucketName = process.env.S3_BUCKET_NAME;
        if (!bucketName) {
            return res.status(500).json({ error: 'S3 bucket name not configured' });
        }

        const presignedData = [];

        for (const file of files) {
            try {
                const uniqueFileName = generateUniqueFileName(file.name);
                const s3Key = `uploads/${uniqueFileName}`;
                const presignedUrl = await generatePresignedUrl(bucketName, s3Key, file.type);

                presignedData.push({
                    originalName: file.name,
                    fileName: uniqueFileName,
                    presignedUrl: presignedUrl,
                    s3Key: s3Key,
                    size: file.size,
                    type: file.type
                });
            } catch (error) {
                console.error(`Error generating presigned URL for ${file.name}:`, error);
                return res.status(500).json({
                    error: `Failed to generate presigned URL for ${file.name}: ${error.message}`
                });
            }
        }

        res.json({
            message: 'Presigned URLs generated successfully',
            presignedData: presignedData,
            count: presignedData.length
        });

    } catch (error) {
        console.error('Presigned URL generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Confirm upload completion
app.post('/confirm-upload', async (req, res) => {
    try {
        const { s3Key, originalName, fileName, size, type } = req.body;
        const bucketName = process.env.S3_BUCKET_NAME;
        const region = process.env.AWS_REGION || 'us-east-1';
        const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;

        res.json({
            message: 'Upload confirmed',
            uploadedFile: {
                originalName: originalName,
                fileName: fileName,
                url: fileUrl,
                size: size,
                type: type
            }
        });

    } catch (error) {
        console.error('Upload confirmation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// List objects in S3 bucket
app.get('/list-files', async (req, res) => {
    try {
        const bucketName = process.env.S3_BUCKET_NAME;
        if (!bucketName) {
            return res.status(500).json({ error: 'S3 bucket name not configured' });
        }
        const region = process.env.AWS_REGION || 'us-east-1';

        const params = {
            Bucket: bucketName,
            Prefix: 'uploads/',
            MaxKeys: 100
        };

        const result = await s3.listObjectsV2(params).promise();
        const files = result.Contents.map(obj => {
            const fileName = obj.Key.split('/').pop();
            const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${obj.Key}`;
            return {
                key: obj.Key,
                fileName: fileName,
                url: fileUrl,
                size: obj.Size,
                lastModified: obj.LastModified,
                etag: obj.ETag
            };
        });

        res.json({
            message: 'Files retrieved successfully',
            files: files,
            count: files.length
        });

    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate download URL for a file
app.post('/download-url', async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) {
            return res.status(400).json({ error: 'File key is required' });
        }

        const bucketName = process.env.S3_BUCKET_NAME;
        const params = {
            Bucket: bucketName,
            Key: key,
            Expires: 60 * 60 // 1 hour
        };

        const downloadUrl = await s3.getSignedUrlPromise('getObject', params);

        res.json({
            message: 'Download URL generated successfully',
            downloadUrl: downloadUrl,
            expiresIn: 3600
        });

    } catch (error) {
        console.error('Download URL generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete a file from S3
app.delete('/delete-file', async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) {
            return res.status(400).json({ error: 'File key is required' });
        }

        const bucketName = process.env.S3_BUCKET_NAME;
        const params = {
            Bucket: bucketName,
            Key: key
        };

        await s3.deleteObject(params).promise();

        res.json({
            message: 'File deleted successfully',
            deletedKey: key
        });

    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' });
        }
    }
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📁 CloudDrive API ready!`);

    const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
        console.warn('Please check your .env file');
    } else {
        console.log('✅ All required environment variables are set');
    }
});
