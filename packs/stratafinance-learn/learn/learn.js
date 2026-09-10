/* Theme, year, quizzes, Time to Pay, debt stress, film beats. */
(function(){
  document.querySelectorAll('.footer-year').forEach(function(el){ el.textContent = String(new Date().getFullYear()); });
  var btn = document.getElementById('theme-toggle');
  if (btn){
    function apply(theme){
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('strata-theme', theme);
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    apply(document.documentElement.getAttribute('data-theme') || 'light');
    btn.addEventListener('click', function(){
      apply(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  document.querySelectorAll('[data-quiz]').forEach(function(box){
    box.querySelectorAll('[data-choice]').forEach(function(choice){
      choice.addEventListener('click', function(){
        if (box.classList.contains('is-answered')) return;
        box.classList.add('is-answered');
        var ok = choice.getAttribute('data-correct') === 'true';
        choice.classList.add(ok ? 'is-right' : 'is-wrong');
        box.querySelectorAll('[data-choice]').forEach(function(other){
          other.disabled = true;
          if (other.getAttribute('data-correct') === 'true') other.classList.add('is-right');
        });
        var explain = box.querySelector('[data-explain]');
        if (explain) explain.hidden = false;
        box.dispatchEvent(new CustomEvent('strata-quiz-answered', { bubbles: true }));
      });
    });
  });

  function gbp(n){
    return new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.round(n || 0));
  }

  var arrearsEl = document.getElementById('ttp-arrears');
  if (arrearsEl){
    var monthsEl = document.getElementById('ttp-months');
    var interestEl = document.getElementById('ttp-interest');
    var rateEl = document.getElementById('ttp-rate');
    var rateWrap = document.getElementById('ttp-rate-wrap');
    var out = document.getElementById('ttp-result');
    function ttpMax(arrears){ return (arrears || 0) < 250000 ? 60 : 12; }
    function render(){
      var arrears = Math.max(0, Number(arrearsEl.value) || 0);
      var max = ttpMax(arrears);
      monthsEl.max = String(max);
      var months = Math.min(max, Math.max(1, Math.round(Number(monthsEl.value) || 12)));
      monthsEl.value = String(months);
      rateWrap.hidden = !interestEl.checked;
      var rate = interestEl.checked ? Math.max(0, Number(rateEl.value) || 0) / 100 : 0;
      var totalInterest = arrears * rate * (months / 12);
      var total = arrears + totalInterest;
      out.innerHTML = '<p class="result-headline ok">'+gbp(total / months)+' / month</p>'
        + '<p class="result-sub">Over '+months+' months · total '+gbp(total)+(totalInterest ? ' including '+gbp(totalInterest)+' estimated interest' : '')+'.</p>'
        + '<p class="disclaimer">Not an offer. HMRC may refuse, shorten, or require a larger first payment.</p>';
    }
    ['input','change'].forEach(function(ev){
      [arrearsEl, monthsEl, interestEl, rateEl].forEach(function(el){ el.addEventListener(ev, render); });
    });
    render();
  }

  var incomeEl = document.getElementById('ds-income');
  if (incomeEl){
    var rowsEl = document.getElementById('ds-rows');
    var resultEl = document.getElementById('ds-result');
    var rowId = 1;
    function rowHtml(id){
      return '<div class="learn-debt-row" data-row="'+id+'">'
        + '<div class="field"><label>Facility</label><input data-k="label" placeholder="e.g. MCA — Lender A"/></div>'
        + '<div class="field"><label>Balance (£)</label><input data-k="balance" type="number" min="0" value="0"/></div>'
        + '<div class="field"><label>Repayment (£)</label><input data-k="repay" type="number" min="0" value="0"/></div>'
        + '<div class="field"><label>Frequency</label><select data-k="freq"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly" selected>Monthly</option></select></div>'
        + '<button type="button" class="tab-btn" data-remove>Remove</button></div>';
    }
    function monthly(amount, freq){
      var v = Math.max(0, amount || 0);
      if (freq === 'daily') return v * 30;
      if (freq === 'weekly') return v * (52/12);
      return v;
    }
    function render(){
      var income = Math.max(0, Number(incomeEl.value) || 0);
      var cash = Math.max(0, Number(document.getElementById('ds-cash').value) || 0);
      var outgoings = ['payroll','rent','hmrc','suppliers','other'].reduce(function(sum, key){
        var map = { payroll:'ds-payroll', rent:'ds-rent', hmrc:'ds-hmrc', suppliers:'ds-suppliers', other:'ds-other' };
        return sum + Math.max(0, Number(document.getElementById(map[key]).value) || 0);
      }, 0);
      var debtBal = 0, debtSvc = 0, stacked = 0;
      rowsEl.querySelectorAll('[data-row]').forEach(function(row){
        debtBal += Math.max(0, Number(row.querySelector('[data-k="balance"]').value) || 0);
        var freq = row.querySelector('[data-k="freq"]').value;
        debtSvc += monthly(Number(row.querySelector('[data-k="repay"]').value) || 0, freq);
        if (freq === 'daily' || freq === 'weekly') stacked += 1;
      });
      var net = income - outgoings - debtSvc;
      var ratio = income > 0 ? debtSvc / income : 0;
      var runway = net < 0 && cash > 0 ? cash / Math.abs(net) : null;
      var html = '<p class="result-headline '+(net < 0 ? 'warn' : 'ok')+'">Net '+gbp(net)+' / month</p>'
        + '<div class="figure-grid">'
        + '<div class="figure"><div class="flabel">Outstanding debt</div><div class="fvalue">'+gbp(debtBal)+'</div></div>'
        + '<div class="figure"><div class="flabel">Monthly debt service</div><div class="fvalue">'+gbp(debtSvc)+'</div></div>'
        + '<div class="figure hi"><div class="flabel">Cost per trading day</div><div class="fvalue">'+gbp(debtSvc/30)+'</div></div>'
        + '<div class="figure"><div class="flabel">Debt-service ratio</div><div class="fvalue">'+(income ? Math.round(ratio*100)+'%' : '—')+'</div></div>'
        + '</div>';
      if (stacked >= 2) html += '<p class="result-sub">You have '+stacked+' facilities pulling daily or weekly — this is what stacking looks like. Each one competes for the same cash before you see it.</p>';
      if (runway != null) html += '<p class="result-sub">Cash runway at this rate: '+runway.toFixed(1)+' months.</p>';
      resultEl.innerHTML = html;
    }
    function bind(){
      rowsEl.querySelectorAll('[data-remove]').forEach(function(btn){
        btn.onclick = function(){
          if (rowsEl.querySelectorAll('[data-row]').length < 2) return;
          btn.closest('[data-row]').remove();
          render();
        };
      });
      rowsEl.querySelectorAll('input,select').forEach(function(el){ el.oninput = render; el.onchange = render; });
    }
    document.getElementById('ds-add').addEventListener('click', function(){
      rowsEl.insertAdjacentHTML('beforeend', rowHtml(++rowId));
      bind();
      render();
    });
    ['ds-income','ds-cash','ds-payroll','ds-rent','ds-hmrc','ds-suppliers','ds-other'].forEach(function(id){
      document.getElementById(id).addEventListener('input', render);
    });
    rowsEl.innerHTML = rowHtml(1);
    bind();
    render();
  }

  var film = document.getElementById('film');
  var beats = window.STRATA_FILM_BEATS;
  if (film && Array.isArray(beats)){
    var answered = [];
    var quizBox = document.getElementById('film-quiz');
    function pending(time){
      for (var i=0;i<beats.length;i++){
        var beat = beats[i];
        if (!beat.quiz || answered.indexOf(beat.id) >= 0) continue;
        if (time + 1e-6 >= beat.pauseAt) return beat;
      }
      return null;
    }
    function show(beat){
      film.pause();
      film.currentTime = beat.pauseAt;
      film.removeAttribute('controls');
      var choices = beat.quiz.choices.map(function(c){
        return '<button type="button" class="learn-choice" data-choice data-correct="'+(c.correct?'true':'false')+'"><span class="learn-choice-label">'+c.label+'</span><span>'+c.text+'</span></button>';
      }).join('');
      quizBox.hidden = false;
      quizBox.innerHTML = '<p class="eyebrow">'+beat.title+'</p><p class="learn-quiz-q">'+beat.quiz.question+'</p><div class="learn-choices">'+choices+'</div><p class="learn-explain" data-explain hidden>'+beat.quiz.explain+'</p>';
      quizBox.querySelectorAll('[data-choice]').forEach(function(choice){
        choice.addEventListener('click', function(){
          if (quizBox.classList.contains('is-answered')) return;
          quizBox.classList.add('is-answered');
          var ok = choice.getAttribute('data-correct') === 'true';
          choice.classList.add(ok ? 'is-right' : 'is-wrong');
          quizBox.querySelectorAll('[data-choice]').forEach(function(other){
            other.disabled = true;
            if (other.getAttribute('data-correct') === 'true') other.classList.add('is-right');
          });
          quizBox.querySelector('[data-explain]').hidden = false;
          var go = document.createElement('button');
          go.type = 'button';
          go.className = 'btn btn-primary';
          go.style.marginTop = '14px';
          go.textContent = 'Continue';
          go.addEventListener('click', function(){
            answered.push(beat.id);
            quizBox.hidden = true;
            quizBox.classList.remove('is-answered');
            quizBox.innerHTML = '';
            film.setAttribute('controls','');
            film.currentTime = beat.pauseAt;
            film.play();
          });
          quizBox.appendChild(go);
        });
      });
    }
    film.addEventListener('timeupdate', function(){
      if (!quizBox.hidden) return;
      var beat = pending(film.currentTime);
      if (beat) show(beat);
    });
  }
})();
