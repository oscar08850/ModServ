import express from 'express'
import cors from 'cors'
import * as bigintConversion from 'bigint-conversion'
import * as rsa from './rsa'
import * as aes from './aes'
import * as modelos from './modelos'
import { PrivateKey, PublicKey } from 'paillier-bigint'

//VARIABLES
const port = 3000
let keyRSA: rsa.rsaKeyPair
let usuarios: modelos.Usuario[] = []
let publicKeyPailler: PublicKey;
let privateKeyPailler: PrivateKey;
let votos: bigint;
let numVotos: number = 0;

export const eliminarUsuario = function (posicion: number): string {
  console.log(usuarios[posicion].nombre + " se ha desconectado")
  const usuario: string = usuarios[posicion].nombre;
  usuarios.splice(posicion, 1);
  return usuario;
}

//SERVIDOR
const app = express()
app.use(cors({
  origin: 'http://localhost:4200' // angular.js server
}), express.json())

app.get('/', (req, res) => {
  res.send('hello world')
})

app.post('/conectar', (req, res) => {
  let i: number = 0;
  let encontrado: Boolean = false;
  const usuario: modelos.Usuario = req.body
  while (i < usuarios.length && !encontrado){
    if (usuarios[i].nombre === usuario.nombre)
        encontrado = true;

    else
        i++;
  }

  if (encontrado === false){
    res.json(usuarios)
    usuarios.push(usuario)
  }

  else{
    res.status(409).json("Este usuario ya está conectado")
  }
})

app.post('/cambiar', (req, res) => {
  let i: number = 0;
  let encontrado: Boolean = false;
  const usuarioAntiguo: string = req.body.usuarioAntiguo;
  const usuarioNuevo: string = req.body.usuarioNuevo;
  while (i < usuarios.length && !encontrado){
    if (usuarios[i].nombre === usuarioNuevo)
        encontrado = true;

    else
        i++;
  }

  if (encontrado === false){
    res.json(usuarios)
    usuarios.forEach((usuarioLista: modelos.Usuario) => {
      if (usuarioLista.nombre === usuarioAntiguo){
        usuarios[usuarios.indexOf(usuarioLista)].nombre = usuarioNuevo;
      }
    })
  }

  else{
    res.status(409).json("Este usuario ya está conectado")
  }
})


//Cuando enviamos un mensaje usando RSA en el frontend
app.post('/mensaje', async (req, res) => {
  const recibido: modelos.MensajeServidor = req.body;
  console.log("El cifrado seleccionado es: " + recibido.tipo) //
  console.log("el mensaje cifrado es: " + recibido.cifrado)
  let cifrado: modelos.cifradoAES;

  
    
  const claveDescifradaBigint: bigint = keyRSA.privateKey.decrypt(bigintConversion.hexToBigint(recibido.clave as string))
  const mensaje: string = recibido.cifrado.slice(0, recibido.cifrado.length - 32)
  const tag: string = recibido.cifrado.slice(recibido.cifrado.length - 32, recibido.cifrado.length)
  const mensajeDescifrado: Buffer = await aes.decrypt(bigintConversion.hexToBuf(mensaje) as Buffer, bigintConversion.hexToBuf(recibido.iv) as Buffer, bigintConversion.hexToBuf(tag) as Buffer, bigintConversion.bigintToBuf(claveDescifradaBigint) as Buffer)
  console.log("MENSAJE RECIBIDO DESCIFRADO: " + bigintConversion.bufToText(mensajeDescifrado))
  cifrado = await aes.encrypt(mensajeDescifrado)
  

  const enviar: modelos.MensajeServidor = {
    usuario: recibido.usuario,
    tipo: recibido.tipo,
    cifrado: cifrado.cifrado + cifrado.authTag,
    iv: cifrado.iv
  }

  console.log("MENSAJE ENVIADO CIFRADO: " + enviar.cifrado)
  res.json(enviar);
})

app.post('/firmar', async (req, res) => {
  console.log("SE FIRMARÁ EL SIGUIENTE MENSAJE: " + req.body.mensaje)
  const firma: bigint = keyRSA.privateKey.sign(bigintConversion.hexToBigint(req.body.mensaje))
  const enviar: modelos.Mensaje = {
    usuario: req.body.usuario,
    mensaje: bigintConversion.bigintToHex(firma)
  }

  console.log("MENSAJE FIRMADO: " + enviar.mensaje)
  res.json(enviar)
})

app.post('/noRepudio', (req, res) => {
  const recibido: modelos.NoRepudio = req.body;
  usuarios.forEach((usuarioLista: modelos.Usuario) => {
    if (usuarioLista.nombre === recibido.usuarioOrigen){
      const clavePublica: rsa.RsaPublicKey = new rsa.RsaPublicKey(bigintConversion.hexToBigint(usuarioLista.eHex), bigintConversion.hexToBigint(usuarioLista.nHex))
      let respuesta: modelos.NoRepudio = {
        usuarioOrigen: recibido.usuarioOrigen,
        usuarioDestino: recibido.usuarioDestino,
        cifrado: recibido.cifrado,
        TimeStamp: recibido.TimeStamp
      }

      var crypto = require('crypto');
      const hash: string = crypto.createHash('sha256').update(JSON.stringify(respuesta)).digest('hex');
      const firmaBigint: bigint = clavePublica.verify(bigintConversion.hexToBigint(recibido.firma as string));
      const firma: string = bigintConversion.bigintToHex(firmaBigint);
      if (hash === firma){
        console.log("SE HA ENVIADO LA CLAVE AL USUARIO")
        respuesta.TimeStamp = new Date(Date.now()).toString();
        const digest: string = crypto.createHash('sha256').update(JSON.stringify(respuesta)).digest('hex');
        const firmaBigint: bigint = keyRSA.privateKey.sign(bigintConversion.hexToBigint(digest));
        respuesta.firma = bigintConversion.bigintToHex(firmaBigint);
        res.json(respuesta);
        const io = require('./sockets').getSocket();
        io.to(respuesta.usuarioDestino).emit('clave', respuesta);
      }
    }
  })
})

app.post('/votar', async function(req, res) {
  if (numVotos < 99){
    const cifradoHex: string = req.body.voto;
    console.log("Voto Recibido: " + cifradoHex);
    const votoCifrado: bigint = bigintConversion.hexToBigint(cifradoHex);
    votos = publicKeyPailler.addition(votoCifrado, votos);
    const recuento: bigint = privateKeyPailler.decrypt(votos)
    console.log("Recuento: " + recuento);
    numVotos = numVotos + 1;
    const recuentoHex: string = bigintConversion.bigintToHex(recuento)
    const io = require('./sockets').getSocket();
    io.emit('recuento', recuentoHex);
    res.json({
      recuento: recuentoHex
    })
  }

  else{
    res.json({
      mensaje: "Se ha llegado al número máximo de votantes",
      recuento: bigintConversion.bigintToHex(votos)
    })
  }
})

app.post('/getClavesCompartidas', function (req, res) {
  const sss = require('shamirs-secret-sharing');
  console.log("Secreto Recibido: " + req.body.secreto);
  const secreto: Buffer = bigintConversion.textToBuf(req.body.secreto) as Buffer; 
  const shares: Buffer[] = sss.split(secreto, { shares: req.body.shared, threshold: req.body.threshold});
  const sharesHex: string[] = [];
  shares.forEach((share: Buffer) => {
    sharesHex.push(bigintConversion.bufToHex(share));
  })

  console.log("Claves Enviadas: " + sharesHex);

  res.json(sharesHex)
})



app.post('/recuperarSecreto', function(req, res) {
  const sss = require('shamirs-secret-sharing');
  const sharesRecuperadasHex: string[] = req.body.claves;
  console.log("Claves Recibidas: " + sharesRecuperadasHex);
  const sharesRecuperadas: Buffer[] = [];
  sharesRecuperadasHex.forEach((shareHex: string) => {
    sharesRecuperadas.push(bigintConversion.hexToBuf(shareHex) as Buffer)
  });

  const secreto = sss.combine(sharesRecuperadas);
  console.log("Secreto Recuperado: " + bigintConversion.bufToText(secreto));
  res.json(bigintConversion.bufToText(secreto));
})

app.get('/rsa', async function (req, res) {
  const paillierBigint = require('paillier-bigint');

  if (keyRSA === undefined){
    keyRSA = await rsa.generateKeys(2048)
    const { publicKey, privateKey } = await paillierBigint.generateRandomKeys(3072)
    publicKeyPailler = publicKey;
    privateKeyPailler = privateKey;
    const iniciarVoto: bigint = 0n;
    votos = publicKeyPailler.encrypt(iniciarVoto);
  }
    
  res.json({
    eHex: bigintConversion.bigintToHex(keyRSA.publicKey.e),
    nHex: bigintConversion.bigintToHex(keyRSA.publicKey.n),
    nPaillierHex: bigintConversion.bigintToHex(publicKeyPailler.n),
    gPaillierHex: bigintConversion.bigintToHex(publicKeyPailler.g)
  })
})


//NECESARIO????


app.get('/aes', async function (req, res) {
  const cifrado: modelos.cifradoAES = await aes.encrypt(bigintConversion.textToBuf("Hola Mundo") as Buffer)
  console.log("Cifrado: " + cifrado.cifrado);
  const mensaje: Buffer = await aes.decrypt(bigintConversion.hexToBuf(cifrado.cifrado) as Buffer, bigintConversion.hexToBuf(cifrado.iv) as Buffer, bigintConversion.hexToBuf(cifrado.authTag) as Buffer)
  console.log("Mensaje: " + bigintConversion.bufToText(mensaje))
  res.json({
    mensajes: {
      mensaje: "Hola Mundo",
      cifrado: cifrado,
      descifrado: bigintConversion.bufToText(mensaje)
    }
  })
})


app.get('/user', (req, res) => {
  const user = {
    username: 'walrus',
    description: 'it is what it is'
  }
  res.json(user)
})

//SERVIDOR SOCKETS
const server = require('http').createServer(app);
module.exports.io = require('socket.io')(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"]
  }
});
require('./sockets');

server.listen(port, function () {
  console.log(`Listening on http://localhost:${port}`)
})