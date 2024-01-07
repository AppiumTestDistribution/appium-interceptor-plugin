## Installing CA vertificate on android device

1. Download the `ca.pem` file from [here](../certificate/certs/ca.pem) and save it to the computer.

2. Push the downloaded certificate to the devices manually or via abd push command as below

    ```shell
    adb push downloaded_cert_path/ca.pem /storage/emulated/0/Download
    ```

    The above command will push the certificate to download directory of the android device.

3. Open `Settings` > `Security settings` > `Encryption and Credentials` > `Install a certificate` > `CA Certificate` > `Install anyway` and choose the `ca.pem` file and install the certificate.

4. Make sure the installed certificate is displayed under `User` section of `Trusted Credentials` settings.

<img src="./ca_install_steps.gif">
