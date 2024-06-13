const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const fs = require('fs');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const port = 3000;

// Configurar multer para manejar la carga de archivos
const upload = multer({ dest: 'uploads/' });

// Configurar AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Configurar MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('Conectado a la base de datos MySQL');
});

app.use(express.static('public'));

// Endpoint para subir archivos
app.post('/upload', upload.single('file'), (req, res) => {
  const fileContent = fs.readFileSync(req.file.path);
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: req.file.originalname,
    Body: fileContent,
  };

  s3.upload(params, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error al subir el archivo');
    }

    // Guardar metadatos en la base de datos
    const metadata = {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      location: data.Location,
    };

    const sql = 'INSERT INTO file_metadata (filename, size, mimetype, location) VALUES (?, ?, ?, ?)';
    db.execute(sql, [metadata.filename, metadata.size, metadata.mimetype, metadata.location], (err, results) => {
      if (err) {
        console.error('Error al guardar metadatos en la base de datos:', err);
        return res.status(500).send('Error al guardar metadatos en la base de datos');
      }
      res.send(`Archivo subido exitosamente. URL: ${data.Location}`);
    });
  });
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
