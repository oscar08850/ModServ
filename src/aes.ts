import crypto from 'crypto'
import * as bigintConversion from 'bigint-conversion'
import * as modelos from './modelos'

const keyHex: string = "2a8ca34dff37278aa820524f329eac5fbcfc39adc553fe383a13391606ff5db9"
const key: Buffer = Buffer.from(keyHex, 'hex')

export const encrypt = async function (mensaje: Buffer): Promise<modelos.cifradoAES> {
    const iv: Buffer = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const ciphertext: Buffer = Buffer.concat([cipher.update(mensaje), cipher.final()])
    const cipherString: string = bigintConversion.bufToHex(ciphertext)
    return {
        cifrado: cipherString,
        iv: iv.toString("hex"),
        authTag: cipher.getAuthTag().toString('hex')
    };
}

export const decrypt = async function (cifrado: Buffer, iv: Buffer, authTag: Buffer, keyTemporal?: Buffer): Promise<Buffer> {
    let decipher;
    if (keyTemporal === undefined)
        decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    
    else
        decipher = crypto.createDecipheriv('aes-256-gcm', keyTemporal, iv)

    decipher.setAuthTag(authTag)
    const mensaje: Buffer = Buffer.concat([decipher.update(cifrado), decipher.final()])
    return mensaje
}