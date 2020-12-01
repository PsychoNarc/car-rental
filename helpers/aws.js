const aws=require('aws-sdk');
const multer=require('multer');
const multers3=require('multer-s3');
const keys=require('../config/keys');

aws.config.update({
    accessKeyId: keys.AWSAccessID,
    secretAccessKey: keys.AWSSecretKey,
    region: 'ap-south-1',
});
//STORAGE USING S3
const s3=new aws.S3({});

//STORAGE USING MULTER
const upload=multer({
    storage: multers3({
        s3: s3,
        bucket: 'car-rent-project',
        acl: 'public-read',
        metadata: (req, file, cb)=>{
            cb(null, {fieldName: file.fieldname});
        },
        key: (req, file, cb)=>{
            cb(null, file.originalname);
        },
        rename: (fieldName, filename)=>{
            return filename.replace(/\W+/g, '-').toLowerCase();
        },
    }),
});
exports.upload=upload;