import { CloudWatchClient, DescribeAlarmsCommand, ListTagsForResourceCommand } from '@aws-sdk/client-cloudwatch';
import { DateTime, DurationLike } from 'luxon';
import { SerialPort } from 'serialport';

// Beeping alarm interval (only alert every 25 minutes using a beep)
const alarmInterval: DurationLike = { minutes: 25 };
let lastAlarm: DateTime = DateTime.now().minus(alarmInterval);

// Alert if needed variable is missing
if (!process.env.SERIALPATH) {
  console.error('You need to specify a serial port e.g. `SERIALPATH=/dev/tty.usbmodem83511301 npm start`');
  process.exit(1);
}

// AWS Init
const client = new CloudWatchClient({ region: 'eu-west-1' });
const getAlarms = new DescribeAlarmsCommand({
  StateValue: 'ALARM'
});

// Serial Port init
const port = new SerialPort({
  path: process.env.SERIALPATH,
  baudRate: 9600
}, (err) => {
  if (err) {
    console.error(`An error occured while opening port to ${process.env.SERIALPATH}`, err);
    process.exit(1);
  }
});

// Enum corresponding to the configured enums on the microcontroller
enum LEDState {
  NONE = 0,
  ALARM = 1,
  ALERT = 2,
  ERR = 3,
  CAUTION = 5,
  WARN = 7,
  OKAY = 9
}
function stringToEnum(value?: string): LEDState {
  if (!value) {
    return LEDState.WARN;
  }
  return LEDState[value as keyof typeof LEDState] ?? LEDState.WARN;
}

async function main() {
  let newState: LEDState = LEDState.OKAY;

  try {
    const states: Array<LEDState> = [];
    // Get CloudWatch Alerts
    const data = await client.send(getAlarms);
    for (const metric of data.MetricAlarms ?? []) {
      if (metric.ActionsEnabled) {
        // Decide per alert which state it should trigger
        const getTags = new ListTagsForResourceCommand({
          ResourceARN: metric.AlarmArn
        });
        const tags = await client.send(getTags);
        const tag = tags.Tags?.find(tag => tag.Key === 'LedTower')?.Value;
        states.push(stringToEnum(tag));
      }
    }
    // Use the most severe error as our new state
    if (states.length > 0) {
      newState = Math.min(...states);
    }
  } catch (err) {
    console.error(err);
    newState = LEDState.CAUTION;
  } finally {
    if (newState === LEDState.ALARM) {
      if (lastAlarm < DateTime.now().minus(alarmInterval)) {
        lastAlarm = DateTime.now();
      } else {
        newState = LEDState.ALERT;
      }
    }
    // Send alert to the microcontroller
    port.write(newState.toString());
  }
}

// Start application
main().catch(console.error);
setInterval(() => {
  main().catch(console.error);
}, 25_000);
