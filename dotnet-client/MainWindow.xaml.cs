using Newtonsoft.Json;
using SocketIOClient;
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Timers = System.Timers;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using System.Windows.Media;
using System.Windows.Threading;

namespace DigitlexViewer;

public partial class MainWindow : Window
{
    private readonly HttpClient _http;
    private readonly CookieContainer _cookies = new();
    private readonly string _appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DigitlexViewer");
    private readonly string _cacheDir;
    private string _serverUrl;
    private string _screenId;
    private SocketIOClient.SocketIO _socket;
    private readonly Timers.Timer _hbTimer = new(30000); // שונה מ-15 ל-30 שניות לטובת עדכון שקט יותר
    private readonly Timers.Timer _syncTimer = new(60000);
    private readonly DispatcherTimer _tickerTimer = new() { Interval = TimeSpan.FromMilliseconds(16) }; // ~60fps
    private readonly DispatcherTimer _messagesScrollTimer = new() { Interval = TimeSpan.FromMilliseconds(16) }; // גיבוי
    private double _messagesOffsetY = 0.0;
    private double _loopGapPx = 160.0; // רווח בין סוף ההודעות לתחילת הלולאה
    private FrameworkElement _stack1 => MessagesStack1;
    private FrameworkElement _stack2 => MessagesStack2;
    private DateTime _lastRenderTime = DateTime.UtcNow;
    private double _scrollSpeedPxPerSec = 45.0;
    private double _tickerX = 10;

    private int _currentIndex = 0;
    private dynamic _contentItems;
    private readonly DispatcherTimer _clockTimer = new() { Interval = TimeSpan.FromSeconds(1) };
    private readonly DispatcherTimer _weatherTimer = new() { Interval = TimeSpan.FromMinutes(10) };
    private string _lastContentSignature = string.Empty;
    private string _currentItemKey = string.Empty;
    private bool _started = false;
    // Offline cache paths
    private string MessagesCachePath => Path.Combine(_appData, "messages.json");
    private string RssCachePath => Path.Combine(_appData, "rss.json");
    private string ContentCachePath => Path.Combine(_appData, "content.json");
    private string ScreenCachePath => Path.Combine(_appData, "screen.json");

    public MainWindow()
    {
        Directory.CreateDirectory(_appData);
        _cacheDir = Path.Combine(_appData, "cache");
        Directory.CreateDirectory(_cacheDir);

        var handler = new HttpClientHandler { CookieContainer = _cookies, AutomaticDecompression = DecompressionMethods.All };
        _http = new HttpClient(handler);
        InitializeComponent();

        LoadConfig();
        if (string.IsNullOrWhiteSpace(_serverUrl) || string.IsNullOrWhiteSpace(_screenId))
        {
            OpenSettings();
        }
        else
        {
            StartAsync();
        }

        _tickerTimer.Tick += (_, _) => AnimateTicker();
        _tickerTimer.Start();
        _messagesScrollTimer.Tick += (_, _) => AnimateMessages();
        _messagesScrollTimer.Stop();
        CompositionTarget.Rendering += OnRendering;
        MessagesCanvas.SizeChanged += (_, __) => LayoutRootMessages();
        _clockTimer.Tick += (_, _) => ClockText.Text = DateTime.Now.ToString("dd/MM/yyyy | HH:mm:ss");
        _clockTimer.Start();
        _weatherTimer.Tick += async (_, _) => await UpdateWeatherAsync();
        _weatherTimer.Start();
        _ = UpdateWeatherAsync();
    }

    private void LoadConfig()
    {
        var cfg = Path.Combine(_appData, "appsettings.json");
        if (File.Exists(cfg))
        {
            dynamic obj = JsonConvert.DeserializeObject(File.ReadAllText(cfg))!;
            _serverUrl = (string?)obj.serverUrl ?? "";
            _screenId = (string?)obj.screenId ?? "";
        }
    }

    private void SaveConfig()
    {
        var cfg = Path.Combine(_appData, "appsettings.json");
        File.WriteAllText(cfg, JsonConvert.SerializeObject(new { serverUrl = _serverUrl, screenId = _screenId }, Formatting.Indented));
    }

    private async void StartAsync()
    {
        if (_started) return; // מניעת התחלה כפולה שגורמת לחיבורים חוזרים
        _started = true;
        _http.BaseAddress = new Uri(_serverUrl);

        ConnectSocket();
        _hbTimer.Elapsed += async (_, _) => await SendHeartbeatAsync();
        _hbTimer.Start();
        _syncTimer.Elapsed += async (_, _) => await SyncLoopAsync();
        _syncTimer.Start();
        await SendHeartbeatAsync();
        await SyncLoopAsync();            // סינכרון נתונים שקט
        await LoadContentAsync();         // התחלת הרוטציה בפועל
    }

    private void ConnectSocket()
    {
        try
        {
            _socket = new SocketIO(_serverUrl, new SocketIOOptions { Path = "/socket.io", Reconnection = true });
            _socket.OnConnected += async (_, __) =>
            {
                await Dispatcher.InvokeAsync(async () =>
                {
                    ConnText.Text = "מחובר";
                    ConnDot.Fill = new SolidColorBrush(Color.FromRgb(0x34,0xC7,0x00));
                    // טען שם מסך ולוגו לכותרת
                    await LoadScreenHeaderAsync();
                }, DispatcherPriority.Background);
            };
            _socket.On("content_updated", _ => Dispatcher.Invoke(async () => await LoadContentAsync(false)));
            _socket.On("screen_status_updated", _ => Dispatcher.Invoke(async () => await LoadContentAsync(false)));
            _ = _socket.ConnectAsync();
        }
        catch { /* ignore */ }
    }

    private async Task SendHeartbeatAsync()
    {
        try
        {
            var res = await _http.PostAsync($"/api/screens/{_screenId}/heartbeat", new StringContent("{}", Encoding.UTF8, "application/json"));
            res.EnsureSuccessStatusCode();
            Dispatcher.Invoke(() => {
                ConnText.Text = "מחובר";
                ConnDot.Fill = new SolidColorBrush(Color.FromRgb(0x34,0xC7,0x00));
            });
        }
        catch { Dispatcher.Invoke(() => { ConnText.Text = "מנותק"; ConnDot.Fill = new SolidColorBrush(Color.FromRgb(0xFF,0x3B,0x30)); }); }
    }

    private async Task SyncLoopAsync()
    {
        await LoadContentAsync(false);
        await LoadMessagesAsync();
        await LoadRssAsync();
    }

    private async Task LoadContentAsync(bool advance = true)
    {
        try
        {
            var json = await TryGetStringAsync($"/api/screens/{_screenId}/content/public");
            if (json == null)
            {
                // offline fallback
                if (File.Exists(ContentCachePath))
                {
                    json = await File.ReadAllTextAsync(ContentCachePath);
                }
            }
            else
            {
                // save cache on success
                SaveCacheSafe(ContentCachePath, json);
            }
            if (json == null) return;

            // אם אין שינוי בתוכן ואין צורך להתקדם, אל תרנדר מחדש
            if (!advance && json == _lastContentSignature)
            {
                return;
            }

            _lastContentSignature = json;
            _contentItems = JsonConvert.DeserializeObject(json)!;
            if (_contentItems.Count == 0) return;
            // שמור על הפריט הנוכחי רק בעדכון נתונים (לא בזמן רוטציה)
            if (!advance && !string.IsNullOrEmpty(_currentItemKey))
            {
                int found = -1;
                for (int i = 0; i < _contentItems.Count; i++)
                {
                    string key = BuildItemKey(_contentItems[i]);
                    if (key == _currentItemKey) { found = i; break; }
                }
                if (found >= 0) _currentIndex = found;
            }
            var item = _contentItems[_currentIndex % _contentItems.Count];
            string type = item.type;
            string title = item.title ?? "";
            string content = item.content ?? "";
            string filePath = item.file_path ?? null;

            string nextKey = BuildItemKey(item);
            // אם אין התקדמות וזה אותו פריט, אל תאפס את התצוגה
            if (!advance && nextKey == _currentItemKey)
            {
                return;
            }

            Dispatcher.Invoke(() => {
                ImageView.Visibility = Visibility.Collapsed;
                VideoView.Visibility = Visibility.Collapsed;
                HtmlView.Visibility = Visibility.Collapsed;
            });

            if (type == "image" || type == "ad")
            {
                var local = await DownloadAsync(filePath);
                if (local != null)
                {
                    Dispatcher.Invoke(() => {
                        ImageView.Source = new BitmapImage(new Uri(local));
                        ImageView.Visibility = Visibility.Visible;
                    });
                }
            }
            else if (type == "video")
            {
                var local = await DownloadAsync(filePath);
                if (local != null)
                {
                    Dispatcher.Invoke(() => {
                        VideoView.Source = new Uri(local);
                        VideoView.Visibility = Visibility.Visible;
                        VideoView.Position = TimeSpan.Zero;
                        VideoView.Play();
                    });
                }
            }
            else // html/code/text
            {
                Dispatcher.Invoke(() => {
                    HtmlView.NavigateToString(content);
                    HtmlView.Visibility = Visibility.Visible;
                });
            }

            _currentItemKey = nextKey;
            // הבא בתור לפי display_duration
            if (advance)
            {
                int durationMs = (int)(item.display_duration ?? 5000);
                if (durationMs < 100) durationMs *= 1000; // תמיכה בשניות
                _ = Task.Run(async () => {
                    await Task.Delay(durationMs);
                    _currentIndex++;
                    await LoadContentAsync();
                });
            }
        }
        catch { /* ignore to keep viewer stable */ }
    }

    private static string BuildItemKey(dynamic item)
    {
        try
        {
            string type = item.type ?? "";
            string title = item.title ?? "";
            string content = item.content ?? "";
            string filePath = item.file_path ?? "";
            return $"{type}|{title}|{filePath}|{content}";
        }
        catch { return Guid.NewGuid().ToString(); }
    }

    private async Task LoadMessagesAsync()
    {
        try
        {
            var json = await TryGetStringAsync($"/api/screens/{_screenId}/messages");
            if (json == null)
            {
                if (File.Exists(MessagesCachePath))
                {
                    json = await File.ReadAllTextAsync(MessagesCachePath);
                }
            }
            else
            {
                SaveCacheSafe(MessagesCachePath, json);
            }
            if (json == null) return;
            dynamic arr = JsonConvert.DeserializeObject(json)!;
            Dispatcher.Invoke(() => {
                MessagesStack1.Children.Clear();
                MessagesStack2.Children.Clear();
                var seen = new System.Collections.Generic.HashSet<string>(System.StringComparer.Ordinal);
                foreach (var it in arr)
                {
                    string id = null; try { id = (string)it.id; } catch { }
                    string text = (string?)it.content ?? "";
                    if (string.IsNullOrWhiteSpace(text)) continue;
                    string key = id ?? text.Trim();
                    if (seen.Add(key))
                    {
                        MessagesStack1.Children.Add(BuildMessageCard(text));
                    }
                }
                // שכפול פעם אחת לסטאק השני עבור לולאה חלקה
                foreach (var child in MessagesStack1.Children)
                {
                    if (child is FrameworkElement fe)
                        MessagesStack2.Children.Add(BuildMessageCard(((TextBlock)((Border)fe).Child).Text));
                }
                LayoutRootMessages();
                _messagesOffsetY = 0.0;
            });
        }
        catch { }
    }

    private async Task LoadRssAsync()
    {
        try
        {
            var json = await TryGetStringAsync($"/api/screens/{_screenId}/rss-content");
            if (json == null)
            {
                if (File.Exists(RssCachePath))
                {
                    json = await File.ReadAllTextAsync(RssCachePath);
                }
            }
            else
            {
                SaveCacheSafe(RssCachePath, json);
            }
            if (json == null) return;
            dynamic arr = JsonConvert.DeserializeObject(json)!;
            Dispatcher.Invoke(() => {
                var unique = new System.Collections.Generic.HashSet<string>();
                var titles = new System.Collections.Generic.List<string>();
                foreach (var it in arr)
                {
                    var t = ((string?)it.title ?? "").Trim();
                    if (string.IsNullOrWhiteSpace(t)) continue;
                    if (unique.Add(t)) titles.Add(t);
                }
                // טיקר משמאל לימין
                TickerText.Text = string.Join("     •     ", titles);
                _tickerX = -TickerText.ActualWidth; // התחל משמאל לזכות
            });
        }
        catch { }
    }

    private record RssItem
    {
        public string Title { get; set; } = "";
        public string Description { get; set; } = "";
    }

    private record MsgItem
    {
        public string Content { get; set; } = "";
    }

    private async Task<string?> DownloadAsync(string relative)
    {
        if (string.IsNullOrWhiteSpace(relative)) return null;
        var uri = new Uri(new Uri(_serverUrl), relative);
        var local = Path.Combine(_cacheDir, Path.GetFileName(uri.LocalPath));
        if (File.Exists(local)) return local;
        try
        {
            using var stream = await _http.GetStreamAsync(uri);
            using var fs = File.Create(local);
            await stream.CopyToAsync(fs);
            return local;
        }
        catch { return null; }
    }

    private async Task LoadScreenHeaderAsync()
    {
        try
        {
            var json = await TryGetStringAsync($"/api/screens/{_screenId}");
            if (json == null)
            {
                if (File.Exists(ScreenCachePath))
                {
                    json = await File.ReadAllTextAsync(ScreenCachePath);
                }
            }
            else
            {
                SaveCacheSafe(ScreenCachePath, json);
            }
            if (json == null) return;
            dynamic obj = JsonConvert.DeserializeObject(json)!;
            string name = (string?)obj.name ?? "";
            string logo = (string?)obj.logo_url ?? "";
            Dispatcher.Invoke(async () =>
            {
                // הצג את שם המסך בכותרת העליונה, ואת הלוגו אם קיים
                if (!string.IsNullOrWhiteSpace(logo))
                {
                    var local = await DownloadAsync(logo);
                    if (local != null)
                    {
                        LogoImage.Source = new BitmapImage(new Uri(local));
                    }
                }
                if (!string.IsNullOrWhiteSpace(name)) TitleText.Text = name;
            });
        }
        catch { }
    }

    private async Task<string?> TryGetStringAsync(string relative)
    {
        try
        {
            return await _http.GetStringAsync(relative);
        }
        catch { return null; }
    }

    private void SaveCacheSafe(string path, string content)
    {
        try
        {
            File.WriteAllText(path, content);
        }
        catch { }
    }

    private async Task UpdateWeatherAsync()
    {
        try
        {
            // מיקום לפי IP (ללא מפתח)
            double lat = 31.771959, lon = 35.217018; // ברירת מחדל ירושלים
            try {
                var ipJson = await _http.GetStringAsync("https://ipapi.co/json/");
                dynamic ipObj = JsonConvert.DeserializeObject(ipJson)!;
                lat = (double?)ipObj.latitude ?? lat;
                lon = (double?)ipObj.longitude ?? lon;
            } catch { }

            // Open-Meteo API ללא מפתח
            var url = $"https://api.open-meteo.com/v1/forecast?latitude={lat:0.####}&longitude={lon:0.####}&current_weather=true";
            var resp = await _http.GetStringAsync(url);
            dynamic obj = JsonConvert.DeserializeObject(resp)!;
            double temp = (double?)obj.current_weather.temperature ?? 0;
            int code = (int?)obj.current_weather.weathercode ?? 0;
            string emoji = code switch
            {
                0 => "☀️",
                1 or 2 => "🌤️",
                3 => "☁️",
                45 or 48 => "🌫️",
                51 or 53 or 55 => "🌦️",
                61 or 63 or 65 => "🌧️",
                71 or 73 or 75 => "❄️",
                95 or 96 or 99 => "⛈️",
                _ => "☁️"
            };
            Dispatcher.Invoke(() =>
            {
                WeatherEmoji.Text = emoji;
                WeatherText.Text = $"{temp:0}°C";
            });
        }
        catch { }
    }

    private void OpenSettings_Click(object sender, RoutedEventArgs e) => OpenSettings();

    private void OpenSettings()
    {
        var dlg = new SettingsWindow(_serverUrl, _screenId);
        if (dlg.ShowDialog() == true)
        {
            _serverUrl = dlg.ServerUrl;
            _screenId = dlg.ScreenId;
            SaveConfig();
            StartAsync();
        }
    }

    private void AnimateTicker()
    {
        try
        {
            // fetch RSS/messages periodically in sync timer (future); now just move text
            Canvas.SetLeft(TickerText, _tickerX);
            _tickerX -= 2; // ימין → שמאל (טקסט RTL)
            if (_tickerX + TickerText.ActualWidth < 0)
            {
                _tickerX = TickerCanvas.ActualWidth;
            }
        }
        catch { }
    }

    private void AnimateMessages()
    {
        try
        {
            // הפונקציה נשארת כגיבוי אם Rendering לא רץ
            StepMessagesScroll(1.0 / 60.0);
        }
        catch { }
    }

    private void OnRendering(object? sender, EventArgs e)
    {
        var now = DateTime.UtcNow;
        var dt = now - _lastRenderTime;
        _lastRenderTime = now;
        StepMessagesScroll(Math.Max(0.0, dt.TotalSeconds));
    }

    private void StepMessagesScroll(double deltaSeconds)
    {
        double viewportH = ((FrameworkElement)MessagesCanvas.Parent).RenderSize.Height;
        if (viewportH <= 0) return;
        // שתי מחסניות זהות זו אחר זו
        var s1 = _stack1.ActualHeight;
        if (s1 <= 0) return;
        double loopLen = s1 + _loopGapPx;
        _messagesOffsetY -= _scrollSpeedPxPerSec * deltaSeconds;
        // לולאה אינסופית באורך ההודעות + רווח
        if (_messagesOffsetY <= -loopLen)
            _messagesOffsetY += loopLen;
        Canvas.SetTop(_stack1, _messagesOffsetY);
        Canvas.SetTop(_stack2, _messagesOffsetY + loopLen);
    }

    private FrameworkElement BuildMessageCard(string text)
    {
        var border = new Border
        {
            Background = (Brush)new BrushConverter().ConvertFromString("#132544"),
            CornerRadius = new CornerRadius(6),
            BorderBrush = (Brush)new BrushConverter().ConvertFromString("#1f3763"),
            BorderThickness = new Thickness(1),
            Padding = new Thickness(10),
            Margin = new Thickness(8, 12, 8, 0)
        };
        var tb = new TextBlock
        {
            Text = text,
            Foreground = (Brush)new BrushConverter().ConvertFromString("#e6f0ff"),
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Right,
            FontSize = 19
        };
        border.Child = tb;
        return border;
    }

    private void LayoutRootMessages()
    {
        MessagesStack1.Measure(new Size(MessagesCanvas.ActualWidth, double.PositiveInfinity));
        MessagesStack2.Measure(new Size(MessagesCanvas.ActualWidth, double.PositiveInfinity));
        Canvas.SetLeft(MessagesStack1, 0);
        Canvas.SetLeft(MessagesStack2, 0);
        Canvas.SetTop(MessagesStack1, 0);
        Canvas.SetTop(MessagesStack2, MessagesStack1.DesiredSize.Height + _loopGapPx);
        _messagesOffsetY = 0.0;
    }

    private void Exit_Click(object sender, RoutedEventArgs e) => Close();

    private void Window_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key == System.Windows.Input.Key.Escape)
        {
            Close();
        }
        if (e.Key == System.Windows.Input.Key.F8)
        {
            OpenSettings();
        }
    }
}


