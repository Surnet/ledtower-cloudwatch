# CloudWatch LED Tower

## Build an LED Tower

See in the [LED Tower Repo](https://github.com/Surnet/ledtower)

## Usage for the Node App

1. Authenticate to AWS
2. Find the port `npx @serialport/list`
3. Start the service `SERIALPATH=/dev/tty.usbmodem83511301 npm start`

## Configuration in CloudWatch

Set a new Tag called `LedTower` on the alarm resource to one of the available enum values
