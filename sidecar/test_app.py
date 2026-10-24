from app import allowed, to_items

listing = {'data': {'children': [
    {'data': {'title': 'A &amp; B', 'permalink': '/r/x/comments/1/a/', 'created': 1700000000.0}},
    {'data': {'title': 'pic', 'permalink': '/r/x/comments/3/p/', 'created': 1.0, 'thumbnail': 'https://t.jpg?a=1&amp;b=2'}},
    {'data': {'title': 'self', 'permalink': '/r/x/comments/4/s/', 'created': 1.0, 'thumbnail': 'self'}},
    {'data': {'title': 'sticky', 'permalink': '/r/x/comments/2/s/', 'created': 1.0, 'stickied': True}},
]}}
assert to_items(listing) == [
    {'title': 'A & B', 'link': 'https://www.reddit.com/r/x/comments/1/a/', 'date': 1700000000000},
    {'title': 'pic', 'link': 'https://www.reddit.com/r/x/comments/3/p/', 'date': 1000, 'image': 'https://t.jpg?a=1&b=2'},
    {'title': 'self', 'link': 'https://www.reddit.com/r/x/comments/4/s/', 'date': 1000},
]
assert allowed('http://trek.lan/') and allowed('https://a.b.lan:8443/x')
assert not allowed('http://example.com/') and not allowed('file:///etc/passwd') and not allowed('http://lan/')
print('ok')
