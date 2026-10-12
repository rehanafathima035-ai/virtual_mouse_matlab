using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace VirtualMouseDriver
{
    public class Program
    {
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, uint dx, uint dy, int dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;

        private const uint MOUSEEVENTF_LEFTDOWN   = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP     = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN  = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP    = 0x0010;
        private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const uint MOUSEEVENTF_MIDDLEUP   = 0x0040;
        private const uint MOUSEEVENTF_WHEEL      = 0x0800;

        public static void Main(string[] args)
        {
            if (args.Length > 0 && args[0].ToLower() != "interactive")
            {
                ExecuteSingleCommand(args);
                return;
            }

            // Interactive streaming mode via standard input
            Console.WriteLine("READY");
            string line;
            while ((line = Console.ReadLine()) != null)
            {
                line = line.Trim();
                if (string.IsNullOrEmpty(line)) continue;

                string[] parts = line.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 0) continue;

                string cmd = parts[0].ToUpper();
                if (cmd == "QUIT" || cmd == "EXIT") break;

                try
                {
                    HandleCommand(cmd, parts);
                }
                catch (Exception ex)
                {
                    Console.WriteLine("ERROR: " + ex.Message);
                }
            }
        }

        private static void HandleCommand(string cmd, string[] parts)
        {
            switch (cmd)
            {
                case "MOVE":
                    if (parts.Length >= 3)
                    {
                        int x = int.Parse(parts[1]);
                        int y = int.Parse(parts[2]);
                        SetCursorPos(x, y);
                        Console.WriteLine("OK");
                    }
                    break;

                case "LEFT_CLICK":
                case "CLICK":
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(20);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    Console.WriteLine("OK");
                    break;

                case "RIGHT_CLICK":
                    mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(20);
                    mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                    Console.WriteLine("OK");
                    break;

                case "DOUBLE_CLICK":
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(20);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(100);
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(20);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    Console.WriteLine("OK");
                    break;

                case "DRAG_START":
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Console.WriteLine("OK");
                    break;

                case "DRAG_END":
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    Console.WriteLine("OK");
                    break;

                case "SCROLL":
                    if (parts.Length >= 2)
                    {
                        int amount = int.Parse(parts[1]);
                        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, amount, UIntPtr.Zero);
                        Console.WriteLine("OK");
                    }
                    break;

                case "GET_SCREEN":
                case "SCREEN":
                    int width = GetSystemMetrics(SM_CXSCREEN);
                    int height = GetSystemMetrics(SM_CYSCREEN);
                    Console.WriteLine("SCREEN " + width + " " + height);
                    break;

                case "PING":
                    Console.WriteLine("PONG");
                    break;

                default:
                    Console.WriteLine("UNKNOWN_CMD");
                    break;
            }
        }

        private static void ExecuteSingleCommand(string[] args)
        {
            string cmd = args[0].ToUpper();
            HandleCommand(cmd, args);
        }
    }
}
