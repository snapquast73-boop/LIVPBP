"""Check static page assets and navigation under the GitHub Pages project prefix."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://snapquast73-boop.github.io/LIVPBP/'


class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('href', 'src'):
            if key not in attrs:
                continue
            target = urlsplit(urljoin(BASE + self.page.name, attrs[key]))
            if target.netloc != urlsplit(BASE).netloc:
                continue
            assert target.path.startswith('/LIVPBP/'), (self.page, target.path)
            path = ROOT / target.path.removeprefix('/LIVPBP/')
            if path.is_dir():
                path /= 'index.html'
            assert path.is_file(), (self.page, path)


for page in sorted(ROOT.glob('*.html')):
    parser = Links()
    parser.page = page
    parser.feed(page.read_text())
    parser.close()
for script in sorted((ROOT / 'assets/js').glob('*.js')):
    subprocess.run(['node', '--check', script], check=True)
print('Static Pages references and JavaScript syntax passed.')
