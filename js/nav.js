// 모바일 메뉴 토글 스크립트
const navToggle = document.querySelector('.nav-toggle');
const navList = document.querySelector('.nav-list');

navToggle.addEventListener('click', function(e) {
  e.stopPropagation();
  navList.classList.toggle('active');
});

document.addEventListener('click', function(e) {
  if (!navList.contains(e.target) && !navToggle.contains(e.target)) {
    navList.classList.remove('active');
  }
}); 