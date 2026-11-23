let timer = null;
export function scheduleStop(stopCallback) {
  const now = new Date();
  // console.log(typeof stopCallback);
  const ist = new Date(
    now.toLocaleString(
      "en-US",
      {
        timeZone: "Asia/Kolkata",
      },
    ),
  );
  const stop = new Date(ist);
  stop.setHours(
    23,
   59,
    0,
    0,
  );
  const delay = stop - ist;
  if (delay <= 0) {
    return;
  }
  timer = setTimeout(
    stopCallback,
    delay,
  );
  // console.log("Auto stop scheduled");
}
