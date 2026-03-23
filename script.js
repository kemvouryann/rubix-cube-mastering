let time = 0;
let interval;

function start() {
  clearInterval(interval);
  interval = setInterval(() => {
    time++;
    document.getElementById("time").innerText = format(time);
  }, 1000);
}

function reset() {
  clearInterval(interval);
  time = 0;
  document.getElementById("time").innerText = "00:00:00";
}

function format(sec) {
  let h = Math.floor(sec / 3600);
  let m = Math.floor((sec % 3600) / 60);
  let s = sec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n) {
  return n < 10 ? "0" + n : n;
}