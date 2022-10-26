import { Stowage } from "types"
import { host } from "utils"
import {useDownload} from "hooks";

type Type = 's3' | 'ipfs'

export default function useOffLicense(_type: Type) {
  return {
    url: _type=='s3' ? url: ipfsUrl,
    key: _type=='s3' ? key: ipfsKey 
  }
}

function key(stowage: Stowage) {
  let rv = stowage.pkg.project
  if (stowage.type == 'bottle') {
    const { platform, arch } = stowage.host ?? host()
    rv += `/${platform}/${arch}`
  }
  rv += `/v${stowage.pkg.version}`
  if (stowage.type == 'bottle') {
    rv += `.tar.${stowage.compression}`
  } else {
    rv +=  stowage.extname
  }
  return rv
}

function url(stowage: Stowage) {
  return new URL(`https://dist.tea.xyz/${key(stowage)}`)
}

async function ipfsUrl(stowage: Stowage) {
  const urlKey = await ipfsKey(stowage)

  if(urlKey.includes(key(stowage))) return url(stowage)
  else return new URL(`http://ipfs.tea.xyz:8080/ipfs/${urlKey}`)

}

async function ipfsKey(stowage: Stowage) {
  const urlCID = new URL(url(stowage) + '.cid')
  const { download } = useDownload()

  try{
    const cid =  await console.silence(() =>
      download({ src: urlCID, ephemeral: true })
    ).then(async dl => {
      const txt = await dl.read()
      return txt.split(' ')[0]
    })
    return cid

  } catch(err){
    console.log("Got error:: ", err, " Getting file from S3 now")
    return key(stowage)
  }
}