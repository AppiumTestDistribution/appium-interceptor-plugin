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

5. Install the plugin by running the command 

    ```shell
    appium plugin install --source=npm appium-interceptor-plugin
    ```
6. To Make sure your setup is working connect your android device/emulator to your machine and run the below command
    
    ```shell
    appium plugin run appium-interceptor test-connection
    ```

    A new browser session will be started in the mobile and you should see the below page opened
     
    <img src="./test-connection.gif">

If you see any errors then retry from step 1 or you can raise an issue with the screeshot and we will guide you with the next steps.
