// ============================================================
//  ui.js — AP2 参数面板绑定 + 键盘交互
// ============================================================

export function initUI(state, camera) {
    const $ = (id) => document.getElementById(id);

    // 直接绑定各滑条
    const orbitSlider = $('orbitSpeed');
    const spinSlider = $('spinSpeed');
    const tiltSlider = $('tiltAngle');
    const showOrbits = $('showOrbits');
    const projBtn = $('projBtn');
    const tourBtn = $('tourBtn');
    const projLabel = $('projLabel');
    const tourLabel = $('tourLabel');

    orbitSlider.oninput = () => {
        state.orbitSpeed = parseFloat(orbitSlider.value);
        $('orbitSpeedVal').textContent = orbitSlider.value;
    };
    spinSlider.oninput = () => {
        state.spinSpeed = parseFloat(spinSlider.value);
        $('spinSpeedVal').textContent = spinSlider.value;
    };
    tiltSlider.oninput = () => {
        state.tiltDeg = parseFloat(tiltSlider.value);
        $('tiltAngleVal').textContent = tiltSlider.value + '°';
    };
    showOrbits.onchange = () => { state.showOrbits = showOrbits.checked; };

    const refreshProj = () => {
        projLabel.textContent = camera.projection === 'perspective' ? '透视投影' : '正交投影';
    };
    projBtn.onclick = () => {
        camera.projection = camera.projection === 'perspective' ? 'ortho' : 'perspective';
        refreshProj();
    };
    tourBtn.onclick = () => {
        // 按钮：进入漫游 / 若在漫游则暂停
        if (camera.tourActive) { camera.tourPaused = !camera.tourPaused; }
        else { camera.tourActive = true; camera.tourPaused = false; }
        refreshTour();
    };
    const refreshTour = () => {
        tourLabel.textContent = camera.tourActive
            ? (camera.tourPaused ? '漫游：暂停' : '漫游：播放中')
            : '手动视角';
    };

    // 初始同步 DOM
    $('orbitSpeedVal').textContent = orbitSlider.value;
    $('spinSpeedVal').textContent = spinSlider.value;
    $('tiltAngleVal').textContent = tiltSlider.value + '°';
    refreshProj();
    refreshTour();

    // 键盘：O 切换投影，空格 暂停/继续漫游
    window.onkeydown = (e) => {
        if (e.key === 'o' || e.key === 'O') {
            camera.projection = camera.projection === 'perspective' ? 'ortho' : 'perspective';
            refreshProj();
            e.preventDefault();
        } else if (e.key === ' ') {
            e.preventDefault();
            if (camera.tourActive) camera.tourPaused = !camera.tourPaused;
            else { camera.tourActive = true; camera.tourPaused = false; }
            refreshTour();
        }
    };

    // 暴露给 main.js 用于鼠标接管后刷新标签
    return { refreshProj, refreshTour };
}
