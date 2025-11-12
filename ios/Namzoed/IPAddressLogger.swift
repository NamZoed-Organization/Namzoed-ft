import Foundation
import Darwin

struct IPAddressLogger {
    static func logIPAddresses(filename: String = "ip.txt") {
        DispatchQueue.global(qos: .utility).async {
            let ips = collectIPAddresses()
            let text = ips.joined(separator: "\n")
            do {
                let docs = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
                let url = docs.appendingPathComponent(filename)
                try text.write(to: url, atomically: true, encoding: .utf8)
                print("IPAddressLogger: Wrote IPs to \(url.path)")
            } catch {
                print("IPAddressLogger: Error writing IPs: \(error)")
            }
        }
    }

    private static func collectIPAddresses() -> [String] {
        var results: [String] = []
        var ifaddrPtr: UnsafeMutablePointer<ifaddrs>? = nil
        guard getifaddrs(&ifaddrPtr) == 0, let first = ifaddrPtr else {
            return results
        }
        defer { freeifaddrs(ifaddrPtr) }

        var ptr = first
        while true {
            let ifa = ptr.pointee
            if let addr = ifa.ifa_addr {
                let family = addr.pointee.sa_family
                if family == UInt8(AF_INET) || family == UInt8(AF_INET6) {
                    let name = String(cString: ifa.ifa_name)
                    if name != "lo0" { // exclude loopback
                        var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                        let length: socklen_t = (family == UInt8(AF_INET))
                            ? socklen_t(MemoryLayout<sockaddr_in>.size)
                            : socklen_t(MemoryLayout<sockaddr_in6>.size)
                        let result = getnameinfo(addr, length, &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
                        if result == 0 {
                            var ip = String(cString: host)
                            // Filter link-local IPv6 and strip scope id
                            if !ip.hasPrefix("fe80") {
                                if let pct = ip.firstIndex(of: "%") { ip = String(ip[..<pct]) }
                                results.append("\(name): \(ip)")
                            }
                        }
                    }
                }
            }
            if let next = ifa.ifa_next {
                ptr = next
            } else {
                break
            }
        }

        if results.isEmpty { results = ["<no ip>"] }
        return results
    }
}
