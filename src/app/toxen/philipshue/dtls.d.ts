export default dtls;
declare const dtls: {
  connect(options: DtlsOptions): Socket;
  
}

interface DtlsOptions {
  type: "udp4";
  remotePort: number;
  remoteAddress: string;
}
