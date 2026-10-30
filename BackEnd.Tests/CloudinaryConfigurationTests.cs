using GestionMesas.Api;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace GestionMesas.Api.Tests;

public sealed class CloudinaryConfigurationTests
{
    [Fact]
    public void SeparateServerVariablesAndCloudinaryUrlSupportPrivateCredentials()
    {
        var direct = CloudinaryInvoiceOptions.FromConfiguration(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Cloudinary:CloudName"] = "my-cloud", ["Cloudinary:ApiKey"] = "123", ["Cloudinary:ApiSecret"] = "test-secret",
            ["Cloudinary:InvoiceFolder"] = "private/invoices"
        }).Build());
        Assert.True(direct.IsConfigured);
        Assert.Equal("private/invoices", direct.Folder);
        var url = CloudinaryInvoiceOptions.FromConfiguration(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["CLOUDINARY_URL"] = "cloudinary://123:test%3Asecret%40value@my-cloud" }).Build());
        Assert.True(url.IsConfigured);
        Assert.Equal("test:secret@value", url.ApiSecret);
        Assert.Equal("my-cloud", url.CloudName);
    }

    [Theory]
    [InlineData("https://unexpected.test", "safe")]
    [InlineData("cloud", "../private")]
    [InlineData("", "safe")]
    public void InvalidCloudNamesAndFoldersCannotChangeTheRemoteApiDestination(string cloud, string folder)
    {
        var options = new CloudinaryInvoiceOptions { CloudName = cloud, ApiKey = "123", ApiSecret = "test-private-key", Folder = folder };
        Assert.False(options.IsConfigured);
        var error = Assert.Throws<InvoiceStorageException>(() => options.RequireConfigured());
        Assert.DoesNotContain(options.ApiSecret, error.Message);
    }
}
