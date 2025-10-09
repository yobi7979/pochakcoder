const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const winston = require('winston');

// CORS 설정
const corsConfig = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
};

// Body Parser 설정
const bodyParserConfig = {
  json: { limit: '5mb' },
  urlencoded: { limit: '5mb', extended: true }
};

// 로깅 설정
const createLogger = () => {
  const logDir = path.join(__dirname, '../logs');
  
  return winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({ 
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true
      }),
      new winston.transports.File({ 
        filename: path.join(logDir, 'app.log'),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
        tailable: true
      }),
      ...(process.env.NODE_ENV !== 'production' ? [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ] : [])
    ]
  });
};

// 정적 파일 설정
const staticConfig = {
  public: {
    path: path.join(__dirname, '../public'),
    options: {
      setHeaders: (res, filePath) => {
        // 한글 파일명을 위한 인코딩 설정
        const fileName = path.basename(filePath);
        if (/[가-힣]/.test(fileName)) {
          // 한글이 포함된 파일명에 대해 UTF-8 인코딩 설정
          res.setHeader('Content-Disposition', 'inline; filename*=UTF-8\'\'' + encodeURIComponent(fileName));
          
          // 파일 확장자에 따른 Content-Type 설정
          const ext = path.extname(fileName).toLowerCase();
          let contentType = 'application/octet-stream';
          
          switch (ext) {
            case '.png':
              contentType = 'image/png';
              break;
            case '.jpg':
            case '.jpeg':
              contentType = 'image/jpeg';
              break;
            case '.gif':
              contentType = 'image/gif';
              break;
            case '.webp':
              contentType = 'image/webp';
              break;
          }
          
          res.setHeader('Content-Type', contentType + '; charset=utf-8');
        }
        
        // 오버레이 이미지 폴더에 대한 추가 설정
        if (filePath.includes('overlay-images')) {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      }
    }
  },
  views: {
    path: path.join(__dirname, '../views')
  }
};

module.exports = {
  corsConfig,
  bodyParserConfig,
  createLogger,
  staticConfig
};
