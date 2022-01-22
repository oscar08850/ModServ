import * as rsa from './rsa'

export interface cifradoAES {
    cifrado: string
    iv: string
    authTag: string
}

export interface Usuario {
    nombre: string
    eHex: string
    nHex: string
}

export interface MensajeServidor {
    usuario: string
    tipo: string
    cifrado: string
    iv: string
    clave?: string
}

export interface Mensaje {
    usuario: string
    mensaje: string
}

export interface NoRepudio {
    usuarioOrigen: string
    usuarioDestino: string
    cifrado: string
    TimeStamp: string
    firma?: string
}