

module.exports = function(attrs) {
    this.name = attrs.name || "";
    this.aliases = attrs.aliases || [];
    this.market = attrs.market || null;
    this.value = attrs.value || 0;
    this.email = attrs.email || "";
};

