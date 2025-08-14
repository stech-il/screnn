using Newtonsoft.Json;
using Quobject.SocketIoClientDotNet.Client;
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Timers;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;

namespace DigitlexViewer;

public partial class MainWindow : Window
{
    private readonly HttpClient _http;
    private readonly CookieContainer _cookies = new();
    private readonly string _appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DigitlexViewer");
    private readonly string _cacheDir;
    private string _serverUrl;
    private string _screenId;
    private Socket _socket;
    private readonly Timer _hbTimer = new(15000);
    private readonly Timer _syncTimer = new(60000);

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
        _http.BaseAddress = new Uri(_serverUrl);
        StatusText.Text = $"שרת: {_serverUrl} | מסך: {_screenId}";

        ConnectSocket();
        _hbTimer.Elapsed += async (_, _) => await SendHeartbeatAsync();
        _hbTimer.Start();
        _syncTimer.Elapsed += async (_, _) => await LoadContentAsync();
        _syncTimer.Start();
        await SendHeartbeatAsync();
        await LoadContentAsync();
    }

    private void ConnectSocket()
    {
        try
        {
            _socket = IO.Socket(_serverUrl);
            _socket.On(Socket.EVENT_CONNECT, _ => Dispatcher.Invoke(() => StatusText.Text += " | Socket✔"));
            _socket.On("content_updated", _ => Dispatcher.Invoke(async () => await LoadContentAsync()));
            _socket.On("screen_status_updated", _ => Dispatcher.Invoke(async () => await LoadContentAsync()));
        }
        catch { /* ignore */ }
    }

    private async Task SendHeartbeatAsync()
    {
        try
        {
            var res = await _http.PostAsync($"/api/screens/{_screenId}/heartbeat", new StringContent("{}", Encoding.UTF8, "application/json"));
            res.EnsureSuccessStatusCode();
        }
        catch { /* ignore */ }
    }

    private async Task LoadContentAsync()
    {
        try
        {
            var json = await _http.GetStringAsync($"/api/screens/{_screenId}/content/public");
            dynamic arr = JsonConvert.DeserializeObject(json)!;
            if (arr.Count == 0) return;
            var item = arr[0]; // הצג פריט ראשון (אפשר להוסיף רוטציה)
            string type = item.type;
            string title = item.title ?? "";
            string content = item.content ?? "";
            string filePath = item.file_path ?? null;

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
        }
        catch { /* ignore to keep viewer stable */ }
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
}


