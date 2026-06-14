// schema.org JSON-LD を <script> として出力する。
// JSON内の '<' をエスケープしてXSSを防ぐ。
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
