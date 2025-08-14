using Newtonsoft.Json;
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using System.Windows.Media;
using System.Windows.Threading;
using System.Collections.Generic;
using System.Linq;
using System.Threading;

namespace DigitlexViewer
{
    public class Message
    {
        public string id { get; set; } = "";
        public string text { get; set; } = "";
        public string content { get; set; } = "";
    }

    public partial class MainWindow : Window
    {
        private readonly HttpClient _http;
        private readonly CookieContainer _cookies = new();
        private readonly string _appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DigitlexViewer");
        private readonly string _cacheDir;
        private string _serverUrl = "https://screnn.onrender.com";
        private string _screenId = "1";
        private readonly System.Timers.Timer _hbTimer = new(15000);
        private readonly System.Timers.Timer _syncTimer = new(60000);
        private readonly DispatcherTimer _tickerTimer = new() { Interval = TimeSpan.FromMilliseconds(16) };
        private List<Message> _messages = new List<Message>();
        private StackPanel _messagesStack;
        private double _messagesOffsetY = 0.0;
        private double _singlePassHeight = 0.0;
        private DateTime _lastRenderTime = DateTime.Now;
        private const double _scrollSpeedPxPerSec = 30.0;
        private double _tickerX = 10;

        private int _currentIndex = 0;
        private dynamic _contentItems = new { };
        private readonly DispatcherTimer _clockTimer = new() { Interval = TimeSpan.FromSeconds(1) };
        private readonly DispatcherTimer _weatherTimer = new() { Interval = TimeSpan.FromMinutes(10) };
        private string _lastContentSignature = string.Empty;
        private string _currentItemKey = string.Empty;
        private bool _started = false;

        public MainWindow()
        {
            // Initialize required fields first
            var handler = new HttpClientHandler { CookieContainer = _cookies, AutomaticDecompression = DecompressionMethods.All };
            _http = new HttpClient(handler);
            _cacheDir = Path.Combine(_appData, "cache");
            
            InitializeComponent();
            
            // Create directories
            Directory.CreateDirectory(_appData);
            Directory.CreateDirectory(_cacheDir);
            
            // Initialize messages
            _messagesStack = new StackPanel();
            MessagesCanvas.Children.Add(_messagesStack);
            _messages.Add(new Message { text = "טוען הודעות..." });
            LayoutRootMessages();
            
            // Start timers
            _clockTimer.Tick += (_, _) => ClockText.Text = DateTime.Now.ToString("dd/MM/yyyy | HH:mm:ss");
            _clockTimer.Start();
            _weatherTimer.Tick += async (_, _) => await UpdateWeatherAsync();
            _weatherTimer.Start();
            _tickerTimer.Tick += (_, _) => AnimateTicker();
            _tickerTimer.Start();
            
            // Load config and start
            LoadConfig();
            _ = StartAsync();
            _ = UpdateWeatherAsync();
            _ = LoadRSSAsync();
        }

        private void LoadConfig()
        {
            try
            {
                var cfg = Path.Combine(_appData, "appsettings.json");
                if (File.Exists(cfg))
                {
                    dynamic obj = JsonConvert.DeserializeObject(File.ReadAllText(cfg));
                    _serverUrl = (string)obj?.serverUrl ?? "https://screnn.onrender.com";
                    _screenId = (string)obj?.screenId ?? "1";
                }
            }
            catch { /* ignore */ }
        }

        private async Task StartAsync()
        {
            if (_started) return;
            _started = true;

            try
            {
                await LoadScreenHeaderAsync();
                await LoadContentAsync(true);
                await LoadMessagesAsync();
                
                // Start heartbeat and sync timers
                _hbTimer.Elapsed += async (_, _) => await SendHeartbeatAsync();
                _hbTimer.Start();
                
                _syncTimer.Elapsed += async (_, _) => 
                {
                    await LoadContentAsync(false);
                    await LoadMessagesAsync();
                };
                _syncTimer.Start();
            }
            catch (Exception ex)
            {
                Dispatcher.Invoke(() => {
                    TitleText.Text = $"שגיאה: {ex.Message}";
                });
            }
        }

        private async Task LoadScreenHeaderAsync()
        {
            try
            {
                Dispatcher.Invoke(() => {
                    TitleText.Text = $"מתחבר לשרת...";
                    ConnText.Text = "מתחבר";
                    ConnDot.Fill = new SolidColorBrush(Colors.Yellow);
                });

                var response = await _http.GetAsync($"{_serverUrl}/api/screens/{_screenId}");
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    dynamic screen = JsonConvert.DeserializeObject(json);
                    
                    Dispatcher.Invoke(() => {
                        TitleText.Text = (string)screen?.name ?? "מסך דיגיטלי";
                        ConnText.Text = "מחובר";
                        ConnDot.Fill = new SolidColorBrush(Color.FromRgb(0x34, 0xC7, 0x00));
                    });
                    
                    // Load logo if exists
                    string logoPath = (string)screen?.logo;
                    if (!string.IsNullOrEmpty(logoPath))
                    {
                        var logoData = await DownloadAsync(logoPath);
                        if (logoData != null)
                        {
                            Dispatcher.Invoke(() => {
                                var bitmap = new BitmapImage();
                                bitmap.BeginInit();
                                bitmap.StreamSource = new MemoryStream(Convert.FromBase64String(logoData));
                                bitmap.EndInit();
                                LogoImage.Source = bitmap;
                            });
                        }
                    }
                }
                else
                {
                    Dispatcher.Invoke(() => {
                        TitleText.Text = $"שגיאת שרת: {response.StatusCode}";
                        ConnText.Text = "לא מחובר";
                        ConnDot.Fill = new SolidColorBrush(Colors.Red);
                    });
                }
            }
            catch (Exception ex)
            {
                Dispatcher.Invoke(() => {
                    TitleText.Text = $"שגיאה: {ex.Message}";
                    ConnText.Text = "שגיאה";
                    ConnDot.Fill = new SolidColorBrush(Colors.Red);
                });
            }
        }

        private async Task LoadContentAsync(bool advance)
        {
            try
            {
                var response = await _http.GetAsync($"{_serverUrl}/api/screens/{_screenId}/content");
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    dynamic content = JsonConvert.DeserializeObject(json);
                    
                    if (content?.items != null && ((Newtonsoft.Json.Linq.JArray)content.items).Count > 0)
                    {
                        _contentItems = content.items;
                        
                        if (advance || _currentIndex >= ((Newtonsoft.Json.Linq.JArray)_contentItems).Count)
                        {
                            _currentIndex = (_currentIndex + 1) % ((Newtonsoft.Json.Linq.JArray)_contentItems).Count;
                        }
                        
                        await DisplayCurrentContent();
                    }
                    else
                    {
                        Dispatcher.Invoke(() => {
                            HtmlView.Text = "אין תוכן זמין במסך זה";
                            HtmlView.Visibility = Visibility.Visible;
                        });
                    }
                }
                else
                {
                    Dispatcher.Invoke(() => {
                        HtmlView.Text = $"שגיאה בטעינת תוכן: {response.StatusCode}";
                        HtmlView.Visibility = Visibility.Visible;
                    });
                }
            }
            catch (Exception ex)
            {
                Dispatcher.Invoke(() => {
                    HtmlView.Text = $"שגיאה: {ex.Message}";
                    HtmlView.Visibility = Visibility.Visible;
                });
            }
        }

        private async Task DisplayCurrentContent()
        {
            try
            {
                var items = (Newtonsoft.Json.Linq.JArray)_contentItems;
                if (items.Count == 0) return;
                
                var item = items[_currentIndex];
                string type = (string)item["type"];
                string content = (string)item["content"];
                string filePath = (string)item["filePath"];

                Dispatcher.Invoke(() => {
                    ImageView.Visibility = Visibility.Collapsed;
                    VideoView.Visibility = Visibility.Collapsed;
                    HtmlView.Visibility = Visibility.Collapsed;
                });

                if (type == "image")
                {
                    var imageData = await DownloadAsync(filePath);
                    if (imageData != null)
                    {
                        Dispatcher.Invoke(() => {
                            var bitmap = new BitmapImage();
                            bitmap.BeginInit();
                            bitmap.StreamSource = new MemoryStream(Convert.FromBase64String(imageData));
                            bitmap.EndInit();
                            ImageView.Source = bitmap;
                            ImageView.Visibility = Visibility.Visible;
                        });
                    }
                }
                else if (type == "video")
                {
                    Dispatcher.Invoke(() => {
                        VideoView.Visibility = Visibility.Visible;
                    });
                }
                else // html/text
                {
                    Dispatcher.Invoke(() => {
                        HtmlView.Text = content;
                        HtmlView.Visibility = Visibility.Visible;
                    });
                }
            }
            catch { /* ignore */ }
        }

        private async Task<string?> DownloadAsync(string relative)
        {
            try
            {
                var response = await _http.GetAsync($"{_serverUrl}{relative}");
                if (response.IsSuccessStatusCode)
                {
                    var bytes = await response.Content.ReadAsByteArrayAsync();
                    return Convert.ToBase64String(bytes);
                }
            }
            catch { /* ignore */ }
            return null;
        }

        private async Task LoadMessagesAsync()
        {
            try
            {
                var response = await _http.GetAsync($"{_serverUrl}/api/screens/{_screenId}/messages");
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    var messages = JsonConvert.DeserializeObject<List<Message>>(json);
                    
                    if (messages != null && messages.Count > 0)
                    {
                        var uniqueMessages = new HashSet<string>();
                        _messages.Clear();
                        
                        foreach (var msg in messages)
                        {
                            var text = msg.text?.Trim();
                            if (!string.IsNullOrEmpty(text) && uniqueMessages.Add(text))
                            {
                                _messages.Add(new Message { text = text });
                            }
                        }
                    }
                    else
                    {
                        _messages.Clear();
                        _messages.Add(new Message { text = "אין הודעות חדשות כרגע" });
                    }
                    
                    Dispatcher.Invoke(() => LayoutRootMessages());
                }
            }
            catch
            {
                _messages.Clear();
                _messages.Add(new Message { text = "אין הודעות חדשות כרגע" });
                Dispatcher.Invoke(() => LayoutRootMessages());
            }
        }

        private void LayoutRootMessages()
        {
            if (_messagesStack == null) return;
            
            _messagesStack.Children.Clear();
            
            var originalMessages = _messages.Count > 0 ? _messages : new List<Message> { new Message { text = "אין הודעות חדשות כרגע" } };
            var viewportHeight = MessagesCanvas.ActualHeight > 0 ? MessagesCanvas.ActualHeight : 360;
            
            // Calculate total height needed
            double totalHeight = 0;
            var tempElements = new List<UIElement>();
            
            foreach (var msg in originalMessages)
            {
                var textBlock = new TextBlock
                {
                    Text = msg.text,
                    Foreground = new SolidColorBrush(Colors.White),
                    FontSize = 18,
                    FontWeight = FontWeights.Bold,
                    Margin = new Thickness(12, 8, 12, 8),
                    TextWrapping = TextWrapping.Wrap,
                    Background = new SolidColorBrush(Color.FromArgb(40, 255, 255, 255)),
                    Padding = new Thickness(12, 8, 12, 8)
                };
                
                textBlock.Measure(new Size(480, double.PositiveInfinity));
                totalHeight += textBlock.DesiredSize.Height;
                tempElements.Add(textBlock);
            }
            
            _singlePassHeight = totalHeight;
            
            // Add enough duplicates for smooth scrolling
            int duplicatesNeeded = Math.Max(1, (int)Math.Ceiling((viewportHeight * 2) / totalHeight));
            
            for (int i = 0; i < duplicatesNeeded; i++)
            {
                foreach (var element in tempElements)
                {
                    _messagesStack.Children.Add(CloneMessageElement(element));
                }
            }
            
            StartMessagesAnimation();
        }

        private UIElement CloneMessageElement(UIElement original)
        {
            if (original is TextBlock textBlock)
            {
                return new TextBlock
                {
                    Text = textBlock.Text,
                    Foreground = textBlock.Foreground,
                    FontSize = textBlock.FontSize,
                    FontWeight = textBlock.FontWeight,
                    Margin = textBlock.Margin,
                    TextWrapping = textBlock.TextWrapping,
                    Background = textBlock.Background,
                    Padding = textBlock.Padding
                };
            }
            return new TextBlock();
        }

        private void StartMessagesAnimation()
        {
            CompositionTarget.Rendering -= AnimateMessages;
            CompositionTarget.Rendering += AnimateMessages;
        }

        private void AnimateMessages(object? sender, EventArgs e)
        {
            var now = DateTime.Now;
            var deltaTime = (now - _lastRenderTime).TotalSeconds;
            _lastRenderTime = now;
            
            _messagesOffsetY -= _scrollSpeedPxPerSec * deltaTime;
            
            if (_messagesOffsetY <= -_singlePassHeight)
            {
                _messagesOffsetY += _singlePassHeight;
            }
            
            Canvas.SetTop(_messagesStack, _messagesOffsetY);
        }

        private async Task SendHeartbeatAsync()
        {
            try
            {
                await _http.PostAsync($"{_serverUrl}/api/screens/{_screenId}/heartbeat", new StringContent(""));
            }
            catch { /* ignore */ }
        }

        private async Task UpdateWeatherAsync()
        {
            try
            {
                var locationResponse = await _http.GetAsync("http://ipapi.co/json/");
                if (locationResponse.IsSuccessStatusCode)
                {
                    var locationJson = await locationResponse.Content.ReadAsStringAsync();
                    dynamic location = JsonConvert.DeserializeObject(locationJson);
                    
                    double lat = (double)location.latitude;
                    double lon = (double)location.longitude;
                    
                    var weatherResponse = await _http.GetAsync($"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true");
                    if (weatherResponse.IsSuccessStatusCode)
                    {
                        var weatherJson = await weatherResponse.Content.ReadAsStringAsync();
                        dynamic weather = JsonConvert.DeserializeObject(weatherJson);
                        
                        double temp = (double)weather.current_weather.temperature;
                        int weatherCode = (int)weather.current_weather.weathercode;
                        
                        string emoji = GetWeatherEmoji(weatherCode);
                        
                        Dispatcher.Invoke(() => {
                            WeatherEmoji.Text = emoji;
                            WeatherText.Text = $"{temp:F0}°C";
                        });
                    }
                }
            }
            catch { /* ignore */ }
        }

        private string GetWeatherEmoji(int code)
        {
            return code switch
            {
                0 => "☀️",  // Clear sky
                1 or 2 or 3 => "⛅",  // Partly cloudy
                45 or 48 => "🌫️",  // Fog
                51 or 53 or 55 => "🌦️",  // Drizzle
                61 or 63 or 65 => "🌧️",  // Rain
                71 or 73 or 75 => "🌨️",  // Snow
                95 or 96 or 99 => "⛈️",  // Thunderstorm
                _ => "🌤️"  // Default
            };
        }

        private void AnimateTicker()
        {
            _tickerX -= 2;
            if (_tickerX < -TickerText.ActualWidth)
            {
                _tickerX = TickerCanvas.ActualWidth;
            }
            Canvas.SetLeft(TickerText, _tickerX);
        }

        private void Window_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
        {
            if (e.Key == System.Windows.Input.Key.Escape)
            {
                this.Close();
            }
            else if (e.Key == System.Windows.Input.Key.F5)
            {
                var settings = new SettingsWindow(_serverUrl, _screenId);
                if (settings.ShowDialog() == true)
                {
                    _serverUrl = settings.ServerUrl;
                    _screenId = settings.ScreenId;
                    _ = StartAsync();
                }
            }
        }
    }
}