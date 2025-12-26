import { WalletManager, type WalletManagerConfig } from 'avm-wallet'
import { ref } from 'vue'
import type algosdk from 'algosdk'

export const WalletManagerPlugin = {
  install(app: any, options: WalletManagerConfig) {
    const manager = new WalletManager(options)
    const algodClient = ref(manager.algodClient)

    const setAlgodClient = (client: algosdk.Algodv2) => {
      algodClient.value = client
      manager.algodClient = client
    }

    app.provide('avmWalletManager', manager)
    app.provide('avmAlgodClient', algodClient)
    app.provide('setAvmAlgodClient', setAlgodClient)

    manager.resumeSessions().catch((error) => {
      console.error('Error resuming sessions:', error)
    })
  }
}
