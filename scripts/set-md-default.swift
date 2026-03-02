import CoreServices
import Foundation

let bundleID = "com.leemoore.mdviewer"
let contentTypes = [
    "net.daringfireball.markdown", // canonical markdown UTI
    "public.plain-text",           // many .md files resolve here
    "public.text"                  // broader text fallback
]

var failures = 0
for type in contentTypes {
    let status = LSSetDefaultRoleHandlerForContentType(type as CFString, LSRolesMask.viewer, bundleID as CFString)
    if status == noErr {
        print("Set viewer for \(type) -> \(bundleID)")
    } else {
        failures += 1
        fputs("Failed for \(type). OSStatus: \(status)\n", stderr)
    }
}

if failures > 0 {
    exit(1)
}
