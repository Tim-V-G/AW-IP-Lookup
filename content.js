chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'getPTRInfo') {
    const ipAddress = request.ipAddress;
    fetch(`https://api.mxtoolbox.com/api/v1/ReverseLookup/ipv4/${ipAddress}`)
      .then(response => response.json())
      .then(data => {
        const ptrInfo = data.Results.map(result => result.PtrDomain).join(', ');
        sendResponse({ ptrInfo: ptrInfo });
      })
      .catch(error => {
        console.error(error);
        sendResponse({ ptrInfo: 'Error occurred during PTR lookup.' });
      });
    return true;
  }
});
