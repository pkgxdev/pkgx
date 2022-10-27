import useOffLicense from "./useOffLicense.ts"
import { Stowage } from 'types';

export default async function useBinaryRepository(stowage: Stowage){
    const ipfsUrl = await useOffLicense('ipfs').url(stowage)
    
    console.log({ipfsUrl})

    if(ipfsUrl == "No CID file in S3"){
        return useOffLicense('s3').url(stowage)
    }
    else return ipfsUrl
    
}