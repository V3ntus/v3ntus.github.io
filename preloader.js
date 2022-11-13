// Preload video
// This improves CSS transition frame rates
fetch("/Videos/journey.mp4")
  .then((r) => {
    if (r.status === 200) {
      r.blob().then((blob) => {
        document
          .getElementById("home_video_src_buf")
          .setAttribute("data-src", URL.createObjectURL(blob));
      });
    }
  })
  .catch(() => {
    console.log("Video preload failed");
  });
