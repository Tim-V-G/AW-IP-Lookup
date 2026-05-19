// popup.js

function updateElement(id, content, isError = false) {
  const element = document.getElementById(id);
  if (element) {
    element.innerHTML = content;
    if (isError) {
      element.classList.add('error');
    } else {
      element.classList.remove('error');
    }
  }
}

function createLoadingSpinner(text) {
  return `<span class="loading">${text}</span>`;
}

function showError(id, message) {
  updateElement(id, message, true);
}

function showSuccess(id, content) {
  updateElement(id, content, false);
}

function showPanelInfo(panelInfo) {
  const panelCard = document.getElementById('panel-card');
  const panelIcon = document.getElementById('panel-icon');
  const panelType = document.getElementById('panel-type');
  const panelLink = document.getElementById('panel-link');

  console.log('showPanelInfo called with:', panelInfo);
  console.log('Elements found:', { panelCard, panelIcon, panelType, panelLink });

  if (panelInfo) {
    console.log('Showing panel info:', panelInfo);
    panelIcon.textContent = panelInfo.icon;
    panelType.textContent = panelInfo.type;
    panelLink.href = panelInfo.url;
    panelCard.style.display = 'block';
    console.log('Panel card display set to block');
  } else {
    console.log('No panel info, hiding card');
    panelCard.style.display = 'none';
  }
}

function hidePanelInfo() {
  const panelCard = document.getElementById('panel-card');
  panelCard.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
  // Controleer of we op een geldige website zijn
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const tab = tabs[0];
    const url = tab.url;

    // Controleer of het een geldige HTTP(S) URL is
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showError('ip-address', 'Geen geldige website');
      showError('ptr-info', 'Niet beschikbaar');
      hidePanelInfo();
      return;
    }

    console.log('Starting lookup for:', url);

    // Haal alle data op in één keer
    chrome.runtime.sendMessage({ action: 'getAllData', url: url }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        showError('ip-address', 'Verbindingsfout');
        showError('ptr-info', 'Verbindingsfout');
        hidePanelInfo();
        return;
      }

      console.log('getAllData response:', response);

      if (response && response.success) {
        // IP adres
        if (response.ipAddress) {
          showSuccess('ip-address', response.ipAddress);
        } else {
          showError('ip-address', 'Geen IP gevonden');
        }

        // PTR informatie
        if (response.ptrInfo && response.ptrInfo !== 'undefined') {
          showSuccess('ptr-info', response.ptrInfo);
        } else {
          showError('ptr-info', 'Geen PTR record gevonden');
        }

        // Panel informatie
        if (response.panelInfo) {
          console.log('Panel info received:', response.panelInfo);
          showPanelInfo(response.panelInfo);
        } else {
          console.log('No panel info received');
          hidePanelInfo();
        }
      } else {
        // Error handling
        showError('ip-address', response.error || 'Onbekende fout');
        showError('ptr-info', 'Lookup gefaald');
        hidePanelInfo();
      }
    });
  });
});

// Debug functie om panel info te loggen
function debugPanelInfo(panelInfo) {
  console.log('Panel debug:', {
    panelInfo,
    cardElement: document.getElementById('panel-card'),
    iconElement: document.getElementById('panel-icon'),
    typeElement: document.getElementById('panel-type'),
    linkElement: document.getElementById('panel-link')
  });
}

