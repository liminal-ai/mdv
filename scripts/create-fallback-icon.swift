import AppKit
import Foundation

let args = CommandLine.arguments
let outputPath = args.count > 1 ? args[1] : "./assets/icon/source/icon-master.png"
let size = CGSize(width: 1024, height: 1024)

let image = NSImage(size: size)
image.lockFocus()

guard let context = NSGraphicsContext.current?.cgContext else {
    fputs("Unable to create graphics context\n", stderr)
    exit(1)
}

let background = NSBezierPath(roundedRect: NSRect(origin: .zero, size: size), xRadius: 220, yRadius: 220)
let gradient = NSGradient(colors: [
    NSColor(calibratedRed: 0.05, green: 0.46, blue: 0.43, alpha: 1.0),
    NSColor(calibratedRed: 0.05, green: 0.64, blue: 0.76, alpha: 1.0)
])
gradient?.draw(in: background, angle: -35)

let docRect = NSRect(x: 225, y: 180, width: 575, height: 690)
let doc = NSBezierPath(roundedRect: docRect, xRadius: 72, yRadius: 72)
NSColor(calibratedWhite: 1.0, alpha: 0.95).setFill()
doc.fill()

let fold = NSBezierPath()
fold.move(to: NSPoint(x: 670, y: 870))
fold.line(to: NSPoint(x: 800, y: 870))
fold.line(to: NSPoint(x: 800, y: 740))
fold.close()
NSColor(calibratedRed: 0.84, green: 0.94, blue: 0.98, alpha: 1).setFill()
fold.fill()

let accentBar = NSBezierPath(roundedRect: NSRect(x: 290, y: 735, width: 445, height: 44), xRadius: 20, yRadius: 20)
NSColor(calibratedRed: 0.05, green: 0.52, blue: 0.49, alpha: 1).setFill()
accentBar.fill()

func line(_ x: CGFloat, _ y: CGFloat, _ width: CGFloat) {
    let p = NSBezierPath(roundedRect: NSRect(x: x, y: y, width: width, height: 28), xRadius: 12, yRadius: 12)
    NSColor(calibratedRed: 0.76, green: 0.86, blue: 0.91, alpha: 1).setFill()
    p.fill()
}

line(290, 660, 380)
line(290, 605, 410)
line(290, 550, 320)

let chart = NSBezierPath()
chart.move(to: NSPoint(x: 300, y: 360))
chart.line(to: NSPoint(x: 430, y: 470))
chart.line(to: NSPoint(x: 525, y: 410))
chart.line(to: NSPoint(x: 675, y: 545))
chart.lineWidth = 20
NSColor(calibratedRed: 0.02, green: 0.41, blue: 0.64, alpha: 1).setStroke()
chart.stroke()

let dotColor = NSColor(calibratedRed: 0.01, green: 0.32, blue: 0.52, alpha: 1)
for point in [
    NSPoint(x: 300, y: 360),
    NSPoint(x: 430, y: 470),
    NSPoint(x: 525, y: 410),
    NSPoint(x: 675, y: 545)
] {
    let dot = NSBezierPath(ovalIn: NSRect(x: point.x - 16, y: point.y - 16, width: 32, height: 32))
    dotColor.setFill()
    dot.fill()
}

context.setStrokeColor(NSColor(calibratedRed: 0.80, green: 0.90, blue: 0.95, alpha: 0.6).cgColor)
context.setLineWidth(4)
context.stroke(CGRect(x: docRect.minX, y: docRect.minY, width: docRect.width, height: docRect.height))

image.unlockFocus()

guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Unable to encode PNG\n", stderr)
    exit(1)
}

let outputURL = URL(fileURLWithPath: outputPath)
try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
try pngData.write(to: outputURL)
print("Wrote fallback icon to \(outputPath)")
