using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

[assembly: AssemblyTitle("CORE//07")]
[assembly: AssemblyDescription("CORE//07 - Audio Reactive Control Rod Matrix")]
[assembly: AssemblyCompany("CORE//07")]
[assembly: AssemblyProduct("CORE07")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace Core07Launcher
{
    internal static class Program
    {
        private const string PayloadResource = "CORE07Payload";
        private const string RuntimeName = "CORE07-runtime-1.0.10.exe";
        private static string runtimeRoot;
        private static string runtimePath;
        private static string runtimeTemp;

        [STAThread]
        private static void Main(string[] args)
        {
            try
            {
                File.WriteAllText(@"C:\Users\Public\core07-launcher-boot.txt",
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "\r\n");
            }
            catch { }

            AppDomain.CurrentDomain.UnhandledException += delegate(object sender, UnhandledExceptionEventArgs e)
            {
                LogException(e.ExceptionObject as Exception);
            };
            Application.ThreadException += delegate(object sender, System.Threading.ThreadExceptionEventArgs e)
            {
                LogException(e.Exception);
            };

            try
            {
                Run(args);
            }
            catch (Exception ex)
            {
                LogException(ex);
                MessageBox.Show("无法启动 CORE//07。\n\n" + ex.Message, "CORE//07", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void Run(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            runtimeRoot = ResolveRuntimeRoot();
            runtimePath = Path.Combine(runtimeRoot, RuntimeName);
            runtimeTemp = Path.Combine(runtimeRoot, "temp");

            using (var splash = new SplashForm())
            {
                splash.Shown += delegate
                {
                    var worker = new BackgroundWorker();
                    worker.DoWork += delegate(object sender, DoWorkEventArgs e)
                    {
                        PreparePayload();
                        e.Result = LaunchPayload(args);
                    };
                    worker.RunWorkerCompleted += delegate(object sender, RunWorkerCompletedEventArgs e)
                    {
                        splash.Close();
                        if (e.Error != null)
                        {
                            MessageBox.Show(
                                "无法启动 CORE//07。\n\n" + e.Error.Message,
                                "CORE//07",
                                MessageBoxButtons.OK,
                                MessageBoxIcon.Error);
                        }
                    };
                    worker.RunWorkerAsync();
                };
                Application.Run(splash);
            }
        }

        private static void LogException(Exception ex)
        {
            try
            {
                string dir = Path.Combine(Environment.GetEnvironmentVariable("PUBLIC") ?? Path.GetTempPath(), "CORE07");
                Directory.CreateDirectory(dir);
                File.AppendAllText(Path.Combine(dir, "launcher-error.log"),
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "\r\n" + (ex == null ? "unknown" : ex.ToString()) + "\r\n\r\n");
            }
            catch { }
        }

        private static string ResolveRuntimeRoot()
        {
            string publicRoot = Environment.GetEnvironmentVariable("PUBLIC");
            if (!string.IsNullOrEmpty(publicRoot))
            {
                string candidate = Path.Combine(publicRoot, "CORE07");
                if (TryPrepareDirectory(candidate)) return candidate;
            }

            string common = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            if (!string.IsNullOrEmpty(common))
            {
                string candidate = Path.Combine(common, "CORE07");
                if (TryPrepareDirectory(candidate)) return candidate;
            }

            string temp = Path.Combine(Path.GetTempPath(), "CORE07");
            if (TryPrepareDirectory(temp)) return temp;

            throw new IOException("无法创建运行目录 / Cannot create runtime directory.");
        }

        private static bool TryPrepareDirectory(string path)
        {
            try
            {
                Directory.CreateDirectory(path);
                string probe = Path.Combine(path, ".write-test");
                File.WriteAllText(probe, "ok");
                File.Delete(probe);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static void PreparePayload()
        {
            Directory.CreateDirectory(runtimeRoot);
            Directory.CreateDirectory(runtimeTemp);

            Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream(PayloadResource);
            if (resource == null)
            {
                throw new InvalidOperationException("内置运行包缺失 / Embedded runtime is missing.");
            }

            long expected;
            using (resource)
            {
                expected = resource.Length;
                if (File.Exists(runtimePath) && new FileInfo(runtimePath).Length == expected)
                {
                    return;
                }

                string partial = runtimePath + ".partial";
                using (var output = new FileStream(partial, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    resource.CopyTo(output);
                }

                if (File.Exists(runtimePath))
                {
                    File.SetAttributes(runtimePath, FileAttributes.Normal);
                    File.Delete(runtimePath);
                }
                File.Move(partial, runtimePath);
            }
        }

        private static bool LaunchPayload(string[] args)
        {
            var info = new ProcessStartInfo();
            info.FileName = runtimePath;
            info.WorkingDirectory = runtimeRoot;
            info.UseShellExecute = false;
            info.EnvironmentVariables["TEMP"] = runtimeTemp;
            info.EnvironmentVariables["TMP"] = runtimeTemp;
            info.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
            info.EnvironmentVariables.Remove("NODE_OPTIONS");

            var command = new StringBuilder();
            for (int i = 0; i < args.Length; i++)
            {
                if (i > 0) command.Append(' ');
                command.Append(QuoteArgument(args[i]));
            }
            info.Arguments = command.ToString();

            Process.Start(info);
            return true;
        }

        private static string QuoteArgument(string value)
        {
            if (string.IsNullOrEmpty(value)) return "\"\"";
            if (value.IndexOf(' ') < 0 && value.IndexOf('\t') < 0) return value;
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }
    }

    internal sealed class SplashForm : Form
    {
        private readonly Label status;

        public SplashForm()
        {
            Text = "CORE//07";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(380, 164);
            BackColor = Color.FromArgb(6, 9, 7);
            ShowInTaskbar = true;
            TopMost = true;

            var title = new Label();
            title.Text = "CORE//07";
            title.ForeColor = Color.FromArgb(231, 227, 211);
            title.Font = new Font("Consolas", 19f, FontStyle.Regular);
            title.AutoSize = true;
            title.Location = new Point(32, 30);
            Controls.Add(title);

            var line = new Panel();
            line.BackColor = Color.FromArgb(111, 103, 74);
            line.Location = new Point(34, 67);
            line.Size = new Size(312, 1);
            Controls.Add(line);

            var subtitle = new Label();
            subtitle.Text = "CONTROL ROD MATRIX / DESKTOP";
            subtitle.ForeColor = Color.FromArgb(169, 163, 140);
            subtitle.Font = new Font("Consolas", 7.5f, FontStyle.Regular);
            subtitle.AutoSize = true;
            subtitle.Location = new Point(35, 80);
            Controls.Add(subtitle);

            status = new Label();
            status.Text = "正在准备桌面堆芯…  PREPARING CORE";
            status.ForeColor = Color.FromArgb(138, 136, 119);
            status.Font = new Font("Microsoft YaHei UI", 8f, FontStyle.Regular);
            status.AutoSize = true;
            status.Location = new Point(35, 112);
            Controls.Add(status);

            var bar = new ProgressBar();
            bar.Style = ProgressBarStyle.Marquee;
            bar.MarqueeAnimationSpeed = 25;
            bar.Location = new Point(35, 137);
            bar.Size = new Size(310, 2);
            Controls.Add(bar);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var pen = new Pen(Color.FromArgb(90, 200, 189, 141), 1))
            {
                e.Graphics.DrawRectangle(pen, 0, 0, ClientSize.Width - 1, ClientSize.Height - 1);
            }
        }
    }
}
