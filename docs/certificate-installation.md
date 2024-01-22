# Installing CA certificate on Android device and emulator

  
## Android emulator (only Android 13 and below)

On the emulator, you can use the below command to install the certificate. You must have `openssl` installed and available on the terminal.

1. Start the emulator with the below command
   ```shell
   emulator -avd <adv_name> -writable-system -wipe-data
   ```
2. Run below commands to download and install the certificate
    ```shell
    # This script does not work on Android 14 and real devices
    curl -o $PWD/ca.pem https://raw.githubusercontent.com/AppiumTestDistribution/appium-interceptor-plugin/master/certificate/certs/ca.pem
    file=$PWD/ca.pem
    filename=$(openssl x509 -noout -subject_hash_old -in $file)
    openssl x509 -in $file > $filename.0
    openssl x509 -in $file  -text -fingerprint -noout >> $filename.0
    adb root
    adb remount
    adb reboot
    adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done;'
    adb root
    adb remount
    adb push $filename.0 /system/etc/security/cacerts
    adb remount
    ```

3. Open `Settings` > `Security settings`> `Encryption and Credentials` > `Encryption and Credentials`.

4. Ensure the installed certificate is displayed under the `System` section of the `Trusted Credentials` settings.
   
   <img width="930" alt="image" src="https://github.com/AppiumTestDistribution/appium-interceptor-plugin/assets/6311526/51885560-be30-455e-9b42-2a829a8f5b8a">

**NOTE:** If you save the emulator snapshot you don't need to add `-writable-system -wipe-data` when you start the emulator from the snapshot. `-writable-system -wipe-data` is required only once.
    

    
## Android real device and Android 14 emulator

1. Download the `ca.pem` file from [here](../certificate/certs/ca.pem) and save it to the computer.

2. Push the downloaded certificate to the devices manually or via abd push command as below

    ```shell
    adb push downloaded_cert_path/ca.pem /storage/emulated/0/Download
    ```

    The above command will push the certificate to the download directory of the Android device.

3. Open `Settings` > `Security settings` > `Encryption and Credentials` > `Install a certificate` > `CA Certificate` > `Install anyway` and choose the `ca.pem` file and install the certificate.

4. Ensure the installed certificate is displayed under the `User` section of the `Trusted Credentials` settings.

<img src="./ca_install_steps.gif">

    
    
    
## Verify certificates have been successfully installed

5. Install the plugin by running the command 

    ```shell
    appium plugin install --source=npm appium-interceptor
    ```
6. To Make sure your setup is working connect your Android device/emulator to your machine and run the below command
    
    ```shell
    appium plugin run appium-interceptor test-connection
    ```

    A new browser session will be started on the mobile and you should see the below page opened
     
    <img src="./test-connection.gif">

If you see any errors then please first retry the steps. If it doesn't work please raise an issue with the screenshot and logs and we will investigate it.
