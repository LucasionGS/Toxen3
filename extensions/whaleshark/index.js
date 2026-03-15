/**
 * EXAMPLE EXTENSION
 * Whale Shark Visualizer Extension for Toxen
 *
 * A whale shark that swims across the screen with wiggle animation,
 * frequency-reactive spots, and dorsal frequency bars.
 */

exports.activate = function (
  /**
   * @type {import("../../src/app/toxen/extensions/toxen-extension-api").ToxenExtensionAPI} api
   */
  api
) {
  api.registerVisualizer("whaleshark", function (rc) {
    var ctx = rc.ctx;
    var dataArray = rc.dataArray;
    var len = rc.len;
    var dataSize = rc.dataSize;
    var vWidth = rc.vWidth;
    var vHeight = rc.vHeight;
    var time = rc.time;
    var dynLight = rc.dynLight;
    var opacity = rc.opacity;
    var pulseEnabled = rc.pulseEnabled;
    var isRainbow = rc.isRainbow;
    var isGlow = rc.isGlow;

    var vsOptions = {
      x: rc.getOption("x") ?? 50,
      y: rc.getOption("y") ?? 50,
      size: rc.getOption("size") ?? 0,
      swimming: rc.getOption("swimming") ?? false,
    };

    var maxHeight = rc.getMaxHeight(0.15);
    var unitH = maxHeight / dataSize;
    var rSizeX = vWidth / 2;
    var rSizeY = vHeight / 2;
    var centerX = typeof vsOptions.x === "number" && vsOptions.x > -0.1 ? (vWidth / 100 * vsOptions.x) : rSizeX;
    var centerY = typeof vsOptions.y === "number" && vsOptions.y > -0.1 ? (vHeight / 100 * vsOptions.y) : rSizeY;

    var baseSize = vsOptions.size > 0 ? vsOptions.size : (Math.min(rSizeX, rSizeY) * 0.45);

    var bodyLen = baseSize * 2.5;
    var halfLen = bodyLen / 2;
    var bodySteps = 50;

    // Wiggle function: t is normalized body position (0=head, 1=tail)
    var wiggle = function (t) {
      return Math.sin(t * Math.PI * 2.5 - time * 0.004) * t * t * halfLen * 0.08 * (1 + dynLight * 0.3);
    };

    // Body half-width as fraction of halfLen
    var bodyHW = function (t) {
      if (t < 0.05) return (0.10 + t * 1.6) * halfLen;
      if (t < 0.15) return (0.18 + (t - 0.05) * 0.4) * halfLen;
      return 0.22 * Math.pow(Math.max(0, 1 - (t - 0.15) / 0.85), 0.55) * halfLen;
    };

    // Swimming: DVD-screensaver style smooth drift with facing direction
    var swimAngleShark = 0;
    if (vsOptions.swimming) {
      var st = time * 0.00006;
      // Padding accounts for full shark extent: half body + tail fin + dorsal fin
      var padX = halfLen + halfLen * 0.18;  // halfLen + tail fin width
      var padY = bodyHW(0.15) + halfLen * 0.2; // max body half-width + dorsal fin height
      var rangeX = Math.max(0, (vWidth - padX * 2) / 2);
      var rangeY = Math.max(0, (vHeight - padY * 2) / 2);
      var freqX1 = 0.6, freqX2 = 1.67;
      var freqY1 = 0.43, freqY2 = 1.21;
      centerX = rSizeX + Math.sin(st * freqX1) * rangeX * 0.65 + Math.sin(st * freqX2) * rangeX * 0.35;
      centerY = rSizeY + Math.sin(st * freqY1) * rangeY * 0.6 + Math.sin(st * freqY2) * rangeY * 0.4;

      var vx = Math.cos(st * freqX1) * freqX1 * rangeX * 0.65 + Math.cos(st * freqX2) * freqX2 * rangeX * 0.35;
      var vy = Math.cos(st * freqY1) * freqY1 * rangeY * 0.6 + Math.cos(st * freqY2) * freqY2 * rangeY * 0.4;
      // Whale shark faces right (+X), so no offset needed
      swimAngleShark = Math.atan2(vy, vx);
    }

    if (pulseEnabled) {
      centerX = rSizeX + ((centerX - rSizeX) * (1 + (dynLight / 4)));
      centerY = rSizeY + ((centerY - rSizeY) * (1 + (dynLight / 4)));
    }

    ctx.globalAlpha = opacity;

    // Apply rotation for swimming direction
    if (vsOptions.swimming && swimAngleShark !== 0) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(swimAngleShark);
      ctx.translate(-centerX, -centerY);
    }

    if (isGlow) rc.setBarShadowBlur(maxHeight * 0.2);

    // --- Body outline ---
    var oldAlpha = ctx.globalAlpha;

    // Body fill
    ctx.globalAlpha = opacity * 0.15;
    ctx.beginPath();
    // Top edge (head to tail)
    for (var i = 0; i <= bodySteps; i++) {
      var t = i / bodySteps;
      var bx = centerX + halfLen - t * bodyLen;
      var hw = bodyHW(t);
      var w = wiggle(t);
      var py = centerY - hw + w;
      if (i === 0) ctx.moveTo(bx, py);
      else ctx.lineTo(bx, py);
    }
    // Bottom edge (tail back to head)
    for (var i = bodySteps; i >= 0; i--) {
      var t = i / bodySteps;
      var bx = centerX + halfLen - t * bodyLen;
      var hw = bodyHW(t);
      var w = wiggle(t);
      ctx.lineTo(bx, centerY + hw + w);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = oldAlpha;

    // Body stroke
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (var i = 0; i <= bodySteps; i++) {
      var t = i / bodySteps;
      var bx = centerX + halfLen - t * bodyLen;
      var hw = bodyHW(t);
      var w = wiggle(t);
      if (i === 0) ctx.moveTo(bx, centerY - hw + w);
      else ctx.lineTo(bx, centerY - hw + w);
    }
    for (var i = bodySteps; i >= 0; i--) {
      var t = i / bodySteps;
      var bx = centerX + halfLen - t * bodyLen;
      var hw = bodyHW(t);
      var w = wiggle(t);
      ctx.lineTo(bx, centerY + hw + w);
    }
    ctx.closePath();
    ctx.stroke();

    // --- Tail fin (crescent/forked) ---
    var tailX = centerX - halfLen;
    var tailW = wiggle(1);
    var tailFinH = halfLen * 0.25;
    var tailFinW = halfLen * 0.18;
    ctx.lineWidth = 2;
    ctx.globalAlpha = opacity * 0.8;
    // Upper lobe
    ctx.beginPath();
    ctx.moveTo(tailX, centerY + tailW);
    ctx.quadraticCurveTo(
      tailX - tailFinW * 0.5, centerY - tailFinH * 0.6 + tailW,
      tailX - tailFinW, centerY - tailFinH + tailW
    );
    ctx.stroke();
    // Lower lobe
    ctx.beginPath();
    ctx.moveTo(tailX, centerY + tailW);
    ctx.quadraticCurveTo(
      tailX - tailFinW * 0.5, centerY + tailFinH * 0.6 + tailW,
      tailX - tailFinW, centerY + tailFinH + tailW
    );
    ctx.stroke();
    // Fill tail
    ctx.globalAlpha = opacity * 0.1;
    ctx.beginPath();
    ctx.moveTo(tailX, centerY + tailW);
    ctx.quadraticCurveTo(tailX - tailFinW * 0.5, centerY - tailFinH * 0.6 + tailW, tailX - tailFinW, centerY - tailFinH + tailW);
    ctx.lineTo(tailX - tailFinW, centerY + tailFinH + tailW);
    ctx.quadraticCurveTo(tailX - tailFinW * 0.5, centerY + tailFinH * 0.6 + tailW, tailX, centerY + tailW);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = oldAlpha;

    // --- Dorsal fin ---
    var dorsalT = 0.3;
    var dorsalX = centerX + halfLen - dorsalT * bodyLen;
    var dorsalW = wiggle(dorsalT);
    var dorsalHW = bodyHW(dorsalT);
    var finH = halfLen * 0.2;
    var finW = halfLen * 0.15;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dorsalX + finW * 0.6, centerY - dorsalHW + dorsalW);
    ctx.quadraticCurveTo(
      dorsalX + finW * 0.1, centerY - dorsalHW - finH + dorsalW,
      dorsalX - finW * 0.4, centerY - dorsalHW + dorsalW
    );
    ctx.stroke();
    // Dorsal fin fill
    ctx.globalAlpha = opacity * 0.1;
    ctx.beginPath();
    ctx.moveTo(dorsalX + finW * 0.6, centerY - dorsalHW + dorsalW);
    ctx.quadraticCurveTo(dorsalX + finW * 0.1, centerY - dorsalHW - finH + dorsalW, dorsalX - finW * 0.4, centerY - dorsalHW + dorsalW);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = oldAlpha;

    // --- Pectoral fins ---
    var pectT = 0.22;
    var pectX = centerX + halfLen - pectT * bodyLen;
    var pectW = wiggle(pectT);
    var pectHW = bodyHW(pectT);
    var pFinLen = halfLen * 0.2;
    var pFinDrop = halfLen * 0.12;
    ctx.lineWidth = 1.5;
    // Left pectoral (bottom side)
    ctx.beginPath();
    ctx.moveTo(pectX, centerY + pectHW + pectW);
    ctx.quadraticCurveTo(
      pectX - pFinLen * 0.3, centerY + pectHW + pFinDrop + pectW,
      pectX - pFinLen, centerY + pectHW + pFinDrop * 0.8 + pectW
    );
    ctx.stroke();

    // --- Eye ---
    var eyeT = 0.04;
    var eyeX = centerX + halfLen - eyeT * bodyLen;
    var eyeHW = bodyHW(eyeT) * 0.5;
    var eyeW = wiggle(eyeT);
    var eyeR = Math.max(2, halfLen * 0.015);
    ctx.globalAlpha = opacity * 0.8;
    ctx.beginPath();
    ctx.arc(eyeX, centerY - eyeHW + eyeW, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX, centerY + eyeHW + eyeW, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = oldAlpha;

    // --- Mouth (wide line at the front) ---
    var mouthX = centerX + halfLen;
    var mouthW = wiggle(0);
    var mouthHW = bodyHW(0) * 0.8;
    ctx.lineWidth = 2;
    ctx.globalAlpha = opacity * 0.5;
    ctx.beginPath();
    ctx.moveTo(mouthX, centerY - mouthHW + mouthW);
    ctx.lineTo(mouthX, centerY + mouthHW + mouthW);
    ctx.stroke();
    ctx.globalAlpha = oldAlpha;

    // --- Gill slits ---
    var gillCount = 5;
    ctx.lineWidth = 1;
    ctx.globalAlpha = opacity * 0.35;
    for (var g = 0; g < gillCount; g++) {
      var gt = 0.08 + g * 0.018;
      var gx = centerX + halfLen - gt * bodyLen;
      var ghw = bodyHW(gt);
      var gw = wiggle(gt);
      var slitH = ghw * 0.5;
      // Top gill
      ctx.beginPath();
      ctx.moveTo(gx, centerY - ghw * 0.3 + gw);
      ctx.lineTo(gx, centerY - ghw * 0.3 - slitH * 0.3 + gw);
      ctx.stroke();
      // Bottom gill
      ctx.beginPath();
      ctx.moveTo(gx, centerY + ghw * 0.3 + gw);
      ctx.lineTo(gx, centerY + ghw * 0.3 + slitH * 0.3 + gw);
      ctx.stroke();
    }
    ctx.globalAlpha = oldAlpha;

    // --- Whale shark spots (frequency reactive) ---
    var spotPositions = [
      // [bodyT, yOffset] - yOffset is fraction of half-width (-1 = top edge, 1 = bottom edge)
      [0.18, -0.4], [0.18, 0.4], [0.22, -0.6], [0.22, 0.1], [0.22, 0.6],
      [0.28, -0.3], [0.28, 0.3], [0.28, -0.7], [0.28, 0.7],
      [0.34, -0.5], [0.34, 0.0], [0.34, 0.5],
      [0.40, -0.3], [0.40, 0.3], [0.40, -0.7], [0.40, 0.7],
      [0.46, -0.5], [0.46, 0.1], [0.46, 0.5],
      [0.52, -0.3], [0.52, 0.3], [0.52, -0.7],
      [0.58, -0.5], [0.58, 0.0], [0.58, 0.5],
      [0.64, -0.3], [0.64, 0.3],
      [0.70, -0.5], [0.70, 0.2],
      [0.76, -0.3], [0.76, 0.3],
      [0.82, 0.0], [0.82, -0.4],
    ];

    for (var s = 0; s < spotPositions.length; s++) {
      var spotT = spotPositions[s][0];
      var sy = spotPositions[s][1];
      var sx = centerX + halfLen - spotT * bodyLen;
      var shw = bodyHW(spotT);
      var sw = wiggle(spotT);

      var dataIdx = Math.min(Math.floor((s / spotPositions.length) * len), len - 1);
      var intensity = dataArray[dataIdx] / dataSize;
      var dotR = Math.max(1.5, halfLen * 0.012) * (1 + intensity * 1.5);

      if (isRainbow) {
        rc.setRainbowIfEnabled(sx, centerY + sy * shw + sw, dotR, dotR, s * (len / spotPositions.length));
      }

      ctx.globalAlpha = opacity * (0.25 + intensity * 0.5);
      ctx.beginPath();
      ctx.arc(sx, centerY + sy * shw + sw, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = oldAlpha;

    // --- Frequency bars along the dorsal ridge ---
    ctx.lineWidth = 1.5;
    var barCount = Math.min(len, 40);
    var barStep = Math.floor(len / barCount);
    if (!isRainbow) {
      if (isGlow) rc.setBarShadowBlur(maxHeight * 0.15);
      ctx.beginPath();
      for (var i = 0; i < barCount; i++) {
        var bt = 0.15 + (i / barCount) * 0.7;
        var bx = centerX + halfLen - bt * bodyLen;
        var bhw = bodyHW(bt);
        var bw = wiggle(bt);
        var barH = Math.max(1, dataArray[i * barStep] * unitH) * 0.15;
        ctx.moveTo(bx, centerY - bhw + bw);
        ctx.lineTo(bx, centerY - bhw - barH + bw);
      }
      ctx.globalAlpha = opacity * 0.6;
      ctx.stroke();
    } else {
      var oldShadow = ctx.shadowBlur;
      ctx.shadowBlur = 0;
      for (var i = 0; i < barCount; i++) {
        var bt = 0.15 + (i / barCount) * 0.7;
        var bx = centerX + halfLen - bt * bodyLen;
        var bhw = bodyHW(bt);
        var bw = wiggle(bt);
        var barH = Math.max(1, dataArray[i * barStep] * unitH) * 0.15;
        rc.setRainbowIfEnabled(bx, centerY - bhw + bw, barH, barH, i * barStep);
        ctx.globalAlpha = opacity * 0.6;
        ctx.beginPath();
        ctx.moveTo(bx, centerY - bhw + bw);
        ctx.lineTo(bx, centerY - bhw - barH + bw);
        ctx.stroke();
      }
      ctx.shadowBlur = oldShadow;
    }

    // Restore rotation transform
    if (vsOptions.swimming && swimAngleShark !== 0) {
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  });
};

exports.deactivate = function () {
  // No cleanup needed
};
