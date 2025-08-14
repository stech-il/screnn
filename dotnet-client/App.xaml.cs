using System;
using System.IO;
using System.Windows;

namespace DigitlexViewer;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        Logger.Log("App starting");
        this.DispatcherUnhandledException += (s, exArgs) =>
        {
            Logger.Log("DispatcherUnhandledException: " + exArgs.Exception);
            try { MessageBox.Show(exArgs.Exception.Message, "שגיאה", MessageBoxButton.OK, MessageBoxImage.Error); } catch { }
            exArgs.Handled = true;
        };
        AppDomain.CurrentDomain.UnhandledException += (s, exArgs) =>
        {
            Logger.Log("UnhandledException: " + exArgs.ExceptionObject);
        };
    }
}

static class Logger
{
    private static readonly string AppDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DigitlexViewer");
    private static readonly string LogPath = Path.Combine(AppDir, "log.txt");
    public static void Log(string message)
    {
        try
        {
            Directory.CreateDirectory(AppDir);
            File.AppendAllText(LogPath, DateTime.Now.ToString("s") + " | " + message + Environment.NewLine);
        }
        catch { }
    }
}


