import { Socket } from "socket.io";
import * as app from './app'
import * as modelos from './modelos'

const { io } = require('./app')

let sockets: Socket[] = [];

io.on('connection', (socket: Socket) => {

    socket.on('nuevoConectado', (usuario: modelos.Usuario) => {
        console.log(usuario.nombre + " se ha conectado");
        socket.join(usuario.nombre);
        sockets.push(socket);
        io.emit('nuevoConectado', usuario)
    });

    socket.on('cambiarNombre', (usuarios: string[]) => {
        socket.rooms.forEach(sala => {
            if (sala.toString() === usuarios[0]){
                socket.leave(usuarios[0]);
                socket.join(usuarios[1]);
            }
        })

        console.log(usuarios[0] + " se ha cambiado el nombre a " + usuarios[1]);
        io.emit('cambiarNombre', usuarios);
    });

    socket.on('nuevoMensaje', (mensaje: modelos.MensajeServidor) => {
        console.log(mensaje.usuario + " ha enviado un mensaje")
        io.emit('nuevoMensaje', mensaje);
    })

    socket.on('mensajeCifrado', (data: modelos.NoRepudio) => {
        console.log(data.usuarioOrigen + " quiere enviar un mensaje a " + data.usuarioDestino)
        socket.to(data.usuarioDestino).emit('mensajeCifrado', data);
    })

    socket.on('contestar', (data: modelos.NoRepudio) => {
        console.log(data.usuarioDestino + " quiere recibir el mensaje de " + data.usuarioOrigen)
        socket.to(data.usuarioOrigen).emit('contestado', data);
    })

    socket.on('noContestado', (usuario: string) => {
        console.log(usuario + " no ha contestado");
        socket.to(usuario).emit('noContestado')
    })

    socket.on('disconnect', function(){
        sockets.forEach(socketLista => {
            if (socket === socketLista){
                const nombre = app.eliminarUsuario(sockets.indexOf(socketLista));
                sockets.splice(sockets.indexOf(socketLista), 1);
                io.emit('desconectado', nombre);
            }
        })
    });
});

function getSocket(){
  return io;
}

module.exports.getSocket = getSocket;