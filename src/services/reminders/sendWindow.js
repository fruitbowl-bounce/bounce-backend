// Reminders only go out between 8am and 8pm UK time (Matt's sign-off doc);
// one that falls due overnight waits until 8am. Confirmations ignore this.
const TIME_ZONE = 'Europe/London';
const HOUR_MS = 60 * 60 * 1000;

const startHour = () => parseInt(process.env.REMINDER_SEND_FROM_HOUR || '8');
const endHour = () => parseInt(process.env.REMINDER_SEND_UNTIL_HOUR || '20');

const londonClock = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type).value);
  return { hour: get('hour'), minute: get('minute'), second: get('second') };
};

const inSendWindow = (date) => {
  const { hour } = londonClock(date);
  return hour >= startHour() && hour < endHour();
};

// The earliest moment at or after `date` that is inside the send window.
const nextSendTime = (date) => {
  if (inSendWindow(date)) return date;

  const { hour, minute, second } = londonClock(date);
  const hoursToWait = hour < startHour() ? startHour() - hour : 24 - hour + startHour();
  let next = new Date(
    date.getTime() + hoursToWait * HOUR_MS - minute * 60 * 1000 - second * 1000 - date.getMilliseconds()
  );

  // A clock change overnight shifts the result by an hour; nudge it back.
  const landed = londonClock(next).hour;
  if (landed !== startHour()) {
    next = new Date(next.getTime() + (startHour() - landed) * HOUR_MS);
  }
  return next;
};

module.exports = { inSendWindow, nextSendTime };
