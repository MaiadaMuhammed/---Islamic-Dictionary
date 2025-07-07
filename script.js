// Add error handling for library loading
window.addEventListener('load', function () {
  console.log('Page loaded, checking libraries...');

  if (typeof $ === 'undefined') {
    console.error('jQuery not loaded!');
    document.getElementById('app').innerHTML = `
      <div class="text-center p-8">
        <h1 class="text-2xl font-bold text-red-600 mb-4">خطأ في تحميل المكتبات</h1>
        <p class="text-gray-600">jQuery لم يتم تحميله بشكل صحيح</p>
        <button onclick="location.reload()" class="bg-green-600 text-white px-4 py-2 rounded mt-4">إعادة التحميل</button>
      </div>
    `;
    return;
  }

  if (typeof gsap === 'undefined') {
    console.warn('GSAP not loaded, animations will be disabled');
  }

  console.log('Libraries loaded successfully');
});

$(document).ready(function () {
  console.log('jQuery ready, initializing app...');
  $('#fallback-content').hide();
  console.log('Fallback content hidden');

  const startPage = `
    <div id="start-page" class="flex flex-col items-center justify-center space-y-8 animate-fadeIn">
      <h1 class="text-3xl md:text-4xl font-bold text-green-800 mb-6">القاموس الإسلامي</h1>
      <div class="flex flex-col w-full space-y-4">
        <button id="quran-mode" class="mode-btn py-3 px-6 rounded-lg bg-green-600 text-white text-xl font-semibold shadow hover:bg-green-700 transition">🔘 البحث في القرآن الكريم</button>
        <button id="hadith-mode" class="mode-btn py-3 px-6 rounded-lg bg-yellow-600 text-white text-xl font-semibold shadow hover:bg-yellow-700 transition">🔘 البحث في الأحاديث النبوية</button>
      </div>
    </div>
  `;
  $('#app').html(startPage);
  console.log('Start page rendered');

  if (typeof gsap !== 'undefined') {
    gsap.from('#start-page', { opacity: 0, y: 40, duration: 1, ease: 'power2.out' });
    console.log('GSAP animation applied');
  } else {
    $('#start-page').addClass('animate-fadeIn');
    console.log('CSS animation applied');
  }

  $(document).on('click', '.mode-btn', function () {
    const mode = $(this).attr('id') === 'quran-mode' ? 'quran' : 'hadith';
    console.log('Mode button clicked:', mode);
    renderSearchPage(mode);
  });

  function addSearchEvents(mode) {
    $(document).on('mouseenter', '#search-btn', function () {
      if (typeof gsap !== 'undefined') gsap.to(this, { scale: 1.08, duration: 0.2 });
    });
    $(document).on('mouseleave', '#search-btn', function () {
      if (typeof gsap !== 'undefined') gsap.to(this, { scale: 1, duration: 0.2 });
    });

    $(document).on('click', '#search-btn', function () {
      handleSearch(mode);
    });
    $(document).on('keydown', '#search-input', function (e) {
      if (e.key === 'Enter') {
        handleSearch(mode);
      }
    });
  }

  async function handleSearch(mode) {
    const query = $('#search-input').val().trim();
    console.log('Search query:', query, 'Mode:', mode);
    if (!query) return;

    $('#results-container').empty().html(`
      <div class="flex justify-center items-center py-8">
        <div class="text-center">
          <svg class="animate-spin h-12 w-12 text-green-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          <p class="text-green-700 font-semibold">جاري البحث...</p>
        </div>
      </div>
    `);

    if (mode === 'quran') {
      try {
        let searchResults = [];

        try {
          const quranRes = await fetch(`https://api.quran.com/api/v4/search?q=${encodeURIComponent(query)}&size=5&page=1&language=ar`);
          const quranData = await quranRes.json();
          if (quranData?.data?.matches) searchResults = quranData.data.matches;
        } catch (err) {
          console.warn('Quran.com search failed', err);
        }

        if (searchResults.length === 0) {
          try {
            const fallbackRes = await fetch(`https://api.alquran.cloud/v1/search/${encodeURIComponent(query)}/all/ar`);
            const fallbackData = await fallbackRes.json();
            if (fallbackData?.data?.matches) searchResults = fallbackData.data.matches;
          } catch (err) {
            console.warn('AlQuran search failed', err);
          }
        }

        if (searchResults.length === 0) {
          showError('❌ لم يتم العثور على نتائج. من فضلك جرّب نصًا آخر.');
          return;
        }

        const result = searchResults[0];
        let surahNum, ayahNum;

        if (result.surah?.number) {
          surahNum = result.surah.number;
          ayahNum = result.numberInSurah;
        } else if (result.surah_id) {
          surahNum = result.surah_id;
          ayahNum = result.verse_number;
        } else {
          surahNum = result.number || 1;
          ayahNum = result.numberInSurah || result.verse_number || 1;
        }

        console.log('Processing ayah:', surahNum, ayahNum);

        const [ayahData, surahData, tafsirData, translationData, audioData] = await Promise.allSettled([
          fetch(`https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/quran-uthmani`).then(r => r.json()),
          fetch(`https://api.alquran.cloud/v1/surah/${surahNum}`).then(r => r.json()),
          fetch(`https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/ar.jalalayn`).then(r => r.json()),
          fetch(`https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/en.sahih`).then(r => r.json()),
          fetch(`https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/ar.alafasy`).then(r => r.json())
        ]);

        const ayahText = ayahData.status === 'fulfilled' ? ayahData.value.data.text : 'غير متوفر';
        const surahInfo = surahData.status === 'fulfilled' ? surahData.value.data : null;
        const tafsir = tafsirData.status === 'fulfilled' ? tafsirData.value.data.text : 'غير متوفر';
        const translation = translationData.status === 'fulfilled' ? translationData.value.data.text : 'غير متوفر';
        const audioUrl = audioData.status === 'fulfilled' ? audioData.value.data.audio : '';

        const resultHtml = `
          <div class="bg-green-50 p-6 rounded-2xl shadow border border-green-100 animate-fadeIn">
            <div class="text-3xl text-green-900 font-bold text-center mb-4">${ayahText}</div>
            <div class="text-center text-green-800 font-semibold mb-2">
              ${surahInfo ? `${surahInfo.name} (${surahInfo.englishName}) - آية ${ayahNum}` : ''}
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm mb-4">
              <h3 class="text-green-800 font-bold mb-2">التفسير:</h3>
              <p class="text-gray-700">${tafsir}</p>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm mb-4">
              <h3 class="text-green-800 font-bold mb-2 ltr">English Translation:</h3>
              <p class="text-gray-700 ltr">${translation}</p>
            </div>
            ${audioUrl ? `
              <div class="bg-white p-4 rounded-xl shadow-sm">
                <h3 class="text-green-800 font-bold mb-2">التلاوة:</h3>
                <audio controls src="${audioUrl}" class="w-full"></audio>
              </div>
            ` : ''}
          </div>
        `;

        $('#results-container').html(resultHtml);
        if (typeof gsap !== 'undefined') {
          gsap.from('#results-container', { opacity: 0, y: 30, duration: 0.7 });
        } else {
          $('#results-container').addClass('animate-fadeIn');
        }

      } catch (err) {
        console.error('Search failed', err);
        showError('حدث خطأ أثناء البحث. الرجاء المحاولة مرة أخرى.');
      }
    } else {
      $('#results-container').html(`
        <div class="text-center py-8 text-gray-600">
          <p class="text-lg">البحث في الأحاديث النبوية سيتم إضافته قريباً</p>
        </div>
      `);
    }
  }

  function showError(msg) {
    $('#results-container').html(`
      <div class="text-center text-red-600 font-bold py-8">
        <p class="text-lg">${msg}</p>
      </div>
    `);
  }

  function renderSearchPage(mode) {
    const modeTitle = mode === 'quran' ? 'البحث في القرآن الكريم' : 'البحث في الأحاديث النبوية';
    const placeholder = mode === 'quran' ? 'أدخل كلمة أو جزء من آية...' : 'أدخل كلمة أو جزء من حديث...';

    const searchPage = `
      <div id="search-page" class="flex flex-col items-center space-y-6 animate-fadeIn">
        <h2 class="text-2xl md:text-3xl font-bold text-green-800 mb-4 text-center">${modeTitle}</h2>
        <div class="w-full max-w-md flex flex-col items-center space-y-4">
          <input id="search-input" type="text" class="rtl w-full p-4 rounded-xl border-2 border-green-200 focus:border-green-500 outline-none text-lg shadow-sm" placeholder="${placeholder}">
          <button id="search-btn" class="py-3 px-8 rounded-xl bg-green-600 text-white text-lg font-semibold shadow-lg hover:bg-green-700 transition duration-200 transform hover:scale-105">بحث</button>
        </div>
        <div id="results-container" class="w-full max-w-4xl mt-8"></div>
      </div>
    `;
    $('#app').html(searchPage);
    setTimeout(() => $('#search-input').focus(), 100);
    addSearchEvents(mode);
  }

  console.log('App initialized successfully');
});

