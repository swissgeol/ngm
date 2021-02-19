const cancel = (event) => event.preventDefault();

export function init(dest, fn) {
  const dropzone = document.querySelector(dest);

  dropzone.addEventListener('dragover', cancel, false);
  dropzone.addEventListener('dragenter', cancel, false);

  dropzone.addEventListener('drop', (event) => {
    for (const file of event.dataTransfer.files) {
      fn(file);
      // const reader = new FileReader();
      // reader.onload = () => {
      //   fn(reader.result, file);
      // };
      // reader.readAsText(file);
    }
    cancel(event);
  }, false);
}


