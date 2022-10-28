import useOffLicense from "./useOffLicense.ts"
import { Stowage } from 'types';

export default async function useBinaryRepository(stowage: Stowage){
    const ipfsUrl = await useOffLicense('ipfs').url(stowage)

    if(ipfsUrl == "No CID file in S3"){
        return new URL(await useOffLicense('s3').url(stowage))
    }
    else return new URL(ipfsUrl)
    
}