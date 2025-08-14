using System.Windows;

namespace DigitlexViewer;

public partial class SettingsWindow : Window
{
    public string ServerUrl { get; private set; }
    public string ScreenId { get; private set; }

    public SettingsWindow(string serverUrl, string screenId)
    {
        InitializeComponent();
        ServerUrlBox.Text = serverUrl ?? "https://screnn.onrender.com";
        ScreenIdBox.Text = screenId ?? string.Empty;
    }

    private void Save_Click(object sender, RoutedEventArgs e)
    {
        ServerUrl = ServerUrlBox.Text.Trim();
        ScreenId = ScreenIdBox.Text.Trim();
        DialogResult = true;
        Close();
    }
}


